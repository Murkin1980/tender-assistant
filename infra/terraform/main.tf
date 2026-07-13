# --- VPC Network ---
resource "google_compute_network" "vpc" {
  name                    = "tender-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "tender-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# --- Firewall Rules ---
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh-enabled"]
}

resource "google_compute_firewall" "allow_http_https" {
  name    = "allow-http-https"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000", "3001"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

# --- Service Account for Backend ---
resource "google_service_account" "backend_sa" {
  account_id   = "backend-sa"
  display_name = "Backend VM Service Account"
}

# Assign Roles to Service Account
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_project_iam_member" "storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

resource "google_project_iam_member" "storage_creator" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# --- Private Connection for Cloud SQL ---
# Reserve an IP range for private services access (for VPC Peering with Cloud SQL)
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

# Establish the private services connection
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

# --- Cloud SQL Instance (PostgreSQL 15) ---
resource "google_sql_database_instance" "postgres" {
  name             = "tender-assistant-db"
  database_version = "POSTGRES_15"
  region           = var.region
  
  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier      = var.db_tier
    disk_size = var.db_disk_size
    disk_type = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = true # Allowed public IP for initial schema setup & local access
      private_network = google_compute_network.vpc.id
    }
  }

  deletion_protection = false # Set to true for production deployment to prevent accidental deletion
}

# Create Database inside the Instance
resource "google_sql_database" "database" {
  name     = "tender_assistant"
  instance = google_sql_database_instance.postgres.name
}

# Create Database User
resource "google_sql_user" "db_user" {
  name     = "tender_app"
  instance = google_sql_database_instance.postgres.name
  password = "SecureTenderAppPassword2026!" # Change this password and keep it safe
}

# --- Cloud Storage Bucket ---
resource "google_storage_bucket" "docs_bucket" {
  name          = var.gcs_bucket_name
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  force_destroy               = true # Allows destroying bucket when running terraform destroy even if it has files
}

# --- Compute Engine VM (backend-vm) ---
resource "google_compute_instance" "backend_vm" {
  name         = "backend-vm"
  machine_type = var.vm_machine_type
  zone         = var.zone

  tags = ["ssh-enabled", "web-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.vm_disk_size
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = google_compute_network.vpc.id
    subnetwork = google_compute_subnetwork.subnet.id

    access_config {
      // Ephemeral public IP to connect from local machine
    }
  }

  service_account {
    email  = google_service_account.backend_sa.email
    scopes = ["cloud-platform"]
  }

  # Startup script to install dependencies automatically
  metadata_startup_script = <<-EOT
    #!/bin/bash
    sudo apt update
    sudo apt install -y git build-essential postgresql-client nginx
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  EOT

  metadata = {
    enable-oslogin = "TRUE"
  }
}
