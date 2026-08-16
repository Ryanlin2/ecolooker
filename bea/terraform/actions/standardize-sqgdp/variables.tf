variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "bucket" {
  description = "S3 bucket holding both the bronze source data and the silver Iceberg output. Must already exist -- this stack does not create it."
  type        = string
  default     = "ecolooker-bea"
}

variable "bronze_prefix" {
  description = "Prefix under bucket that sqgdp_full_download lands raw CSVs into, one ingestion_date=<UTC timestamp> partition per run. This job reads from whichever partition sorts last."
  type        = string
  default     = "bronze/sqgdp/"
}

variable "silver_prefix" {
  description = "Prefix under bucket used as the Iceberg warehouse root. The table ends up at <silver_prefix>/<iceberg_database>.db/<iceberg_table>/."
  type        = string
  default     = "silver/sqgdp/"
}

variable "script_s3_key" {
  description = "S3 key (within bucket) that the Glue job script is uploaded to."
  type        = string
  default     = "scripts/glue/sqgdp_iceberg_job.py"
}

variable "iceberg_database" {
  description = "Glue Data Catalog database the Iceberg table is registered in. Created by this stack if it doesn't already exist."
  type        = string
  default     = "bea"
}

variable "iceberg_table" {
  description = "Name of the Iceberg table this job MERGEs standardized SQGDP rows into."
  type        = string
  default     = "sqgdp_state_gdp"
}

variable "glue_job_name" {
  description = "Name of the Glue Spark ETL job."
  type        = string
  default     = "standardize-sqgdp"
}

variable "glue_version" {
  description = "Glue version for the Spark ETL job. 4.0+ is required for native Iceberg support."
  type        = string
  default     = "4.0"
}

variable "worker_type" {
  description = "Glue worker type for the Spark job."
  type        = string
  default     = "G.1X"
}

variable "number_of_workers" {
  description = "Number of Glue workers for the Spark job."
  type        = number
  default     = 2
}

variable "timeout" {
  description = "Glue job timeout, in minutes."
  type        = number
  default     = 30
}
