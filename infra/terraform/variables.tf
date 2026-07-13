variable "project_id" {
  type        = string
  description = "The ID of the GCP project"
  default     = "tender-assistant"
}

variable "region" {
  type        = string
  description = "The region to deploy resources in"
  default     = "us-central1" # Most economical GCP region
}

variable "zone" {
  type        = string
  description = "The zone to deploy resources in"
  default     = "us-central1-a"
}

variable "vm_machine_type" {
  type        = string
  description = "The machine type for the backend VM"
  default     = "n4-standard-4" # 4 vCPU, 16 GB RAM (per specifications)
}

variable "db_tier" {
  type        = string
  description = "The tier (machine type) for the Cloud SQL database"
  default     = "db-custom-2-8192" # Custom machine with 2 vCPU, 8 GB RAM (per specifications)
}

variable "db_disk_size" {
  type        = number
  description = "The size of the database disk in GB"
  default     = 100
}

variable "vm_disk_size" {
  type        = number
  description = "The size of the VM boot disk in GB"
  default     = 200
}

variable "gcs_bucket_name" {
  type        = string
  description = "The name of the GCS bucket for documents (must be globally unique)"
  default     = "tender-assistant-docs-murkin1980"
}
