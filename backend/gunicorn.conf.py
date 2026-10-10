import os

bind = "0.0.0.0:8000"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
accesslog = "-"
errorlog = "-"
# Do not log query strings, cookies, authorization headers or request bodies.
access_log_format = '%(h)s %(t)s "%(m)s %(U)s %(H)s" %(s)s %(b)s %(L)s'
forwarded_allow_ips = "*"  # Only Nginx can reach this private Compose network.
worker_tmp_dir = "/tmp"
max_requests = 1000
max_requests_jitter = 100
