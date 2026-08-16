data "aws_s3_bucket" "output" {
  bucket = var.output_bucket
}

resource "aws_s3_object" "glue_script" {
  bucket = data.aws_s3_bucket.output.id
  key    = var.script_s3_key
  source = "${path.module}/../../../glue/sqgdp_download_to_s3.py"
  etag   = filemd5("${path.module}/../../../glue/sqgdp_download_to_s3.py")
}

resource "aws_iam_role" "glue_role" {
  name = "glue-sqgdp-full-download-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "glue.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "glue_sqgdp" {
  name = "glue-sqgdp-full-download-policy"
  role = aws_iam_role.glue_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"

        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]

        Resource = "arn:aws:logs:*:*:log-group:/aws-glue/*"
      },
      {
        Sid    = "ReadGlueScript"
        Effect = "Allow"

        Action = [
          "s3:GetObject"
        ]

        Resource = "${data.aws_s3_bucket.output.arn}/${var.script_s3_key}"
      },
      {
        Sid    = "GetBucketLocation"
        Effect = "Allow"

        Action = [
          "s3:GetBucketLocation"
        ]

        Resource = data.aws_s3_bucket.output.arn
      },
      {
        Sid    = "WriteSqgdpOutput"
        Effect = "Allow"

        Action = [
          "s3:PutObject"
        ]

        Resource = "${data.aws_s3_bucket.output.arn}/${var.output_prefix}*"
      }
    ]
  })
}

resource "aws_glue_job" "sqgdp_full_download" {
  name     = var.glue_job_name
  role_arn = aws_iam_role.glue_role.arn

  glue_version = var.glue_version
  max_capacity = var.max_capacity

  command {
    name            = "pythonshell"
    script_location = "s3://${data.aws_s3_bucket.output.id}/${aws_s3_object.glue_script.key}"
    python_version  = var.python_version
  }

  default_arguments = {
    "--ZIP_URL"      = var.zip_url
    "--S3_BUCKET"    = data.aws_s3_bucket.output.id
    "--S3_PREFIX"    = var.output_prefix
    "--job-language" = "python"
  }
}
