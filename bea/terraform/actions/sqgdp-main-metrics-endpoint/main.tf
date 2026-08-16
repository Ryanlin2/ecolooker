data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "data" {
  bucket = var.bucket
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/sqgdp_main_metrics.py"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "lambda-sqgdp-main-metrics-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "lambda.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_sqgdp_main_metrics" {
  name = "lambda-sqgdp-main-metrics-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "RunAthenaQueries"
        Effect = "Allow"

        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution"
        ]

        Resource = "arn:aws:athena:${var.aws_region}:${data.aws_caller_identity.current.account_id}:workgroup/${var.athena_workgroup}"
      },
      {
        Sid    = "ReadGlueCatalog"
        Effect = "Allow"

        Action = [
          "glue:GetDatabase",
          "glue:GetTable",
          "glue:GetTables",
          "glue:GetPartition",
          "glue:GetPartitions"
        ]

        Resource = [
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:database/${var.athena_database}",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.athena_database}/*"
        ]
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
        Sid    = "ListForQueryAndOutput"
        Effect = "Allow"

        Action = [
          "s3:ListBucket"
        ]

        Resource = data.aws_s3_bucket.data.arn

        Condition = {
          StringLike = {
            "s3:prefix" = [
              "${var.silver_prefix}*",
              "${var.athena_output_prefix}*",
              "${var.gold_prefix}*"
            ]
          }
        }
      },
      {
        Sid    = "ReadSilverIceberg"
        Effect = "Allow"

        Action = [
          "s3:GetObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.silver_prefix}*"
      },
      {
        Sid    = "ReadWriteAthenaOutput"
        Effect = "Allow"

        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.athena_output_prefix}*"
      },
      {
        Sid    = "ReadWriteGoldEndpoint"
        Effect = "Allow"

        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]

        Resource = "${data.aws_s3_bucket.data.arn}/${var.gold_prefix}*"
      }
    ]
  })
}

resource "aws_lambda_function" "sqgdp_main_metrics" {
  function_name = var.lambda_function_name

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  role = aws_iam_role.lambda_role.arn

  handler = "sqgdp_main_metrics.lambda_handler"
  runtime = var.lambda_runtime

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  environment {
    variables = {
      ATHENA_DATABASE        = var.athena_database
      ATHENA_OUTPUT_LOCATION = "s3://${var.bucket}/${var.athena_output_prefix}"
      RESULTS_BUCKET         = var.bucket
      RESULTS_KEY            = var.results_key
      ATHENA_WORKGROUP       = var.athena_workgroup
      ALLOWED_ORIGIN         = var.allowed_origin
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_sqgdp_main_metrics,
    aws_iam_role_policy_attachment.lambda_logs
  ]
}

resource "aws_lambda_function_url" "sqgdp_main_metrics" {
  function_name      = aws_lambda_function.sqgdp_main_metrics.function_name
  authorization_type = "NONE"
}
