output "vm_public_ip" {
  value       = google_compute_instance.backend_vm.network_interface[0].access_config[0].nat_ip
  description = "The public IP address of the backend server"
}

output "db_private_ip" {
  value       = google_sql_database_instance.postgres.private_ip_address
  description = "The private IP address of the database"
}

output "db_public_ip" {
  value       = google_sql_database_instance.postgres.public_ip_address
  description = "The public IP address of the database"
}

output "gcs_bucket_name" {
  value       = google_storage_bucket.docs_bucket.name
  description = "The name of the Cloud Storage bucket"
}
