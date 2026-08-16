variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "output_bucket" {
  description = "S3 bucket that receives the downloaded SQGDP CSVs. Must already exist -- this stack does not create it."
  type        = string
  default     = "ecolooker-bea"
}

variable "output_prefix" {
  description = "Prefix under output_bucket to land data in. The job appends its own ingestion_date=<UTC timestamp> partition below this prefix."
  type        = string
  default     = "bronze/sqgdp/"
}

variable "script_s3_key" {
  description = "S3 key (within output_bucket) that the Glue job script is uploaded to."
  type        = string
  default     = "scripts/glue/sqgdp_download_to_s3.py"
}

variable "zip_url" {
  description = "URL of the BEA SQGDP.zip export, passed to the job as --ZIP_URL."
  type        = string
  default     = "https://apps.bea.gov/regional/zip/SQGDP.zip"
}

variable "glue_job_name" {
  description = "Name of the Glue Python Shell job."
  type        = string
  default     = "sqgdp-full-download"
}

variable "glue_version" {
  description = "Glue version for the Python Shell job."
  type        = string
  default     = "3.0"
}

variable "python_version" {
  description = "Python version for the Python Shell job."
  type        = string
  default     = "3.9"
}

variable "max_capacity" {
  description = "DPU capacity for the Python Shell job (smallest tier -- single-threaded I/O job)."
  type        = number
  default     = 0.0625
}
