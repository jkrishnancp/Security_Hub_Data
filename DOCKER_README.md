# Security Data Hub - Docker Deployment

This guide explains how to deploy the Security Data Hub application using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of available RAM
- 10GB of available disk space

## Quick Start

### 1. Simple Deployment (SQLite)

For development or small-scale deployments:

```bash
# Deploy the application
./deploy.sh deploy

# Application will be available at: http://localhost:3000
# Complete the onboarding wizard to set up your company and admin account
```

### 2. Production Deployment (PostgreSQL)

For production environments with better scalability:

```bash
# Set up environment variables
cp .env.production .env
# Edit .env with your production values

# Deploy with PostgreSQL
./deploy.sh deploy-prod
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.production`:

```bash
# Required
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-random-secret
POSTGRES_PASSWORD=your-secure-db-password

# Optional
LOG_LEVEL=info
MAX_FILE_SIZE=50MB
```

### SSL/HTTPS Setup

1. Place your SSL certificates in the `./ssl/` directory:
   - `cert.pem` - Your SSL certificate
   - `key.pem` - Your private key

2. Uncomment the HTTPS server block in `nginx.conf`

3. Update `NEXTAUTH_URL` to use `https://`

## Management Commands

```bash
# Deploy application
./deploy.sh deploy

# Deploy with PostgreSQL (production)
./deploy.sh deploy-prod

# Stop all services
./deploy.sh stop

# View application logs
./deploy.sh logs

# Check service status
./deploy.sh status

# Manual backup
./deploy.sh backup
```

## Data Persistence

Data is stored in the following locations:

- **SQLite Mode**: `./data/database/` - Database files
- **PostgreSQL Mode**: Docker volume `postgres_data`
- **Uploads**: `./data/uploads/` - User uploaded files
- **Logs**: `./logs/` - Application logs

## Backup and Restore

### Automatic Backup

Backups are automatically created before deployments in `./backups/`

### Manual Backup

```bash
# Create backup
./deploy.sh backup

# Restore from backup (example)
tar -xzf ./backups/backup_20240101_120000.tar.gz -C ./data/
```

### PostgreSQL Backup

```bash
# Backup PostgreSQL database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U security_user security_data_hub > backup.sql

# Restore PostgreSQL database
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U security_user security_data_hub < backup.sql
```

## Monitoring

### Health Checks

The application includes built-in health checks:

```bash
# Check application health
curl http://localhost:3000/api/auth/session

# View service status
docker-compose ps
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
./deploy.sh logs

# View specific service logs
docker-compose logs security-data-hub
docker-compose logs nginx
```

## Performance Tuning

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  security-data-hub:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Database Optimization

For PostgreSQL production deployments:

```yaml
postgres:
  environment:
    POSTGRES_INITDB_ARGS: "--data-checksums"
  command: >
    postgres
    -c max_connections=200
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=64MB
```

## Security Considerations

### Network Security

- The application runs on an isolated Docker network
- Only necessary ports are exposed
- Nginx provides additional security headers

### File Security

- Uploaded files are scanned and validated
- File types are restricted based on configuration
- Files are stored outside the web root

### Database Security

- Database runs on an internal network
- Strong passwords are required
- Regular security updates through base image updates

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"
   ```

2. **Database Connection Issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U security_user
   
   # View database logs
   docker-compose logs postgres
   ```

3. **Permission Issues**
   ```bash
   # Fix data directory permissions
   sudo chown -R $USER:$USER ./data
   chmod -R 755 ./data
   ```

### Log Locations

- Application logs: `./logs/`
- Nginx logs: `./logs/nginx/`
- Docker logs: `docker-compose logs`

## Updates and Maintenance

### Application Updates

```bash
# Stop current deployment
./deploy.sh stop

# Pull latest code
git pull

# Deploy updated version
./deploy.sh deploy
```

### Database Migrations

Migrations are automatically run during deployment. For manual migration:

```bash
docker-compose exec security-data-hub npx prisma db push
```

### System Maintenance

- Regular backups are recommended before updates
- Monitor disk space in `./data/` directory
- Rotate log files periodically
- Update base Docker images monthly for security patches

## Support

For issues and questions:
- Check application logs: `./deploy.sh logs`
- Verify service status: `./deploy.sh status`
- Review this documentation
- Check Docker and Docker Compose versions