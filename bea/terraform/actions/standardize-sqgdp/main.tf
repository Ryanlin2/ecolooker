data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "data" {
  bucket = var.bucket
}

resource "aws_s3_object" "glue_script" {
  bucket = data.aws_s3_bucket.data.id
  key    = var.script_s3_key
  source = "${path.module}/../../../glue/sqgdp_iceberg_job.py"
  etag   = filemd5("${path.module}/../../../glue/sqgdp_iceberg_job.py")
}

resource "aws_glue_catalog_database" "bea" {
  name = var.iceberg_database
}

resource "aws_iam_role" "glue_role" {
  name = "glue-standardize-sqgdp-role"

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

resource "aws_iam_role_policy" "glue_standardize_sqgdp" {
  name = "glue-standardize-sqgdp-policy"
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

        Resource = "${data.aws_s3_bucket.data.arn}/${var.script_s3_key}"
      },
      {
        Sid    = "GetBucketLocation"
        Effect = "Allow"

        Action = [
          "s3:GetBucketLocation"
        ]

        Resource = data.aws_s3_bucket.data.arn
      },
      {
        Sid    = "ListBronzeAndSilver"
        Effect = "Allow"

        Action = [
          "s3:ListBucket"
        ]

        Resource = data.aws_s3_bucket.data.arn

        Condition = {
          StringLike = {
            "s3:prefix" = [
              "${var.bronze_prefix}*",
              "${var.silver_prefix}*"
            ]
          }
        }
      },
      {
        Sid    = "ReadBronzeSqgdp"
        Effect = "Allow"

        Action = [
          "s3:GetObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.bronze_prefix}*"
      },
      {
        Sid    = "ReadWriteSilverSqgdp"
        Effect = "Allow"

        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.silver_prefix}*"
      },
      {
        Sid    = "GlueCatalog"
        Effect = "Allow"

        Action = [
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:CreateDatabase",
          "glue:GetTable",
          "glue:GetTables",
          "glue:CreateTable",
          "glue:UpdateTable",
          "glue:GetPartition",
          "glue:GetPartitions",
          "glue:CreatePartition",
          "glue:BatchCreatePartition",
          "glue:UpdatePartition",
          "glue:DeletePartition",
          "glue:BatchDeletePartition"
        ]

        Resource = [
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:database/${var.iceberg_database}",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.iceberg_database}/${var.iceberg_table}"
        ]
      }
    ]
  })
}

resource "aws_glue_job" "standardize_sqgdp" {
  name     = var.glue_job_name
  role_arn = aws_iam_role.glue_role.arn

  glue_version      = var.glue_version
  worker_type       = var.worker_type
  number_of_workers = var.number_of_workers
  timeout           = var.timeout

  command {
    name            = "glueetl"
    script_location = "s3://${data.aws_s3_bucket.data.id}/${aws_s3_object.glue_script.key}"
    python_version  = "3"
  }

  default_arguments = {
    "--job-language"     = "python"
    "--datalake-formats" = "iceberg"
    "--conf" = join(" ", [
      "spark.sql.catalog.glue_catalog=org.apache.iceberg.spark.SparkCatalog",
      "--conf spark.sql.catalog.glue_catalog.warehouse=s3://${var.bucket}/${var.silver_prefix}",
      "--conf spark.sql.catalog.glue_catalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog",
      "--conf spark.sql.catalog.glue_catalog.io-impl=org.apache.iceberg.aws.s3.S3FileIO",
      "--conf spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions"
    ])
    "--RAW_S3_BUCKET"                    = var.bucket
    "--RAW_S3_PREFIX"                    = var.bronze_prefix
    "--ICEBERG_DATABASE"                 = var.iceberg_database
    "--ICEBERG_TABLE"                    = var.iceberg_table
    "--TempDir"                          = "s3://${var.bucket}/${var.silver_prefix}_tmp/${var.glue_job_name}/"
    "--enable-continuous-cloudwatch-log" = "true"
  }
}
