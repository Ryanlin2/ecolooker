output "glue_job_name" {
  description = "Name of the Glue Spark ETL job"
  value       = aws_glue_job.standardize_sqgdp.name
}

output "glue_role_arn" {
  description = "IAM role ARN the Glue job runs as"
  value       = aws_iam_role.glue_role.arn
}

output "script_s3_uri" {
  description = "S3 location of the uploaded Glue job script"
  value       = "s3://${data.aws_s3_bucket.data.id}/${aws_s3_object.glue_script.key}"
}

output "iceberg_warehouse_s3_uri" {
  description = "S3 prefix used as the Iceberg warehouse root"
  value       = "s3://${data.aws_s3_bucket.data.id}/${var.silver_prefix}"
}

output "iceberg_table_fqn" {
  description = "Fully qualified Iceberg table name (Glue Catalog database.table)"
  value       = "${var.iceberg_database}.${var.iceberg_table}"
}
