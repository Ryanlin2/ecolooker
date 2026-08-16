output "glue_job_name" {
  description = "Name of the Glue Python Shell job"
  value       = aws_glue_job.sqgdp_full_download.name
}

output "glue_role_arn" {
  description = "IAM role ARN the Glue job runs as"
  value       = aws_iam_role.glue_role.arn
}

output "script_s3_uri" {
  description = "S3 location of the uploaded Glue job script"
  value       = "s3://${data.aws_s3_bucket.output.id}/${aws_s3_object.glue_script.key}"
}

output "output_s3_uri" {
  description = "S3 prefix the job lands data under (partitioned by ingestion_date=<UTC timestamp> below this)"
  value       = "s3://${data.aws_s3_bucket.output.id}/${var.output_prefix}"
}
