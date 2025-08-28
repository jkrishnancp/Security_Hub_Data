# 🛡️ Security Data Hub

A comprehensive security data management platform for centralizing and analyzing security alerts, vulnerabilities, and compliance data from multiple sources.

![Security Data Hub](https://img.shields.io/badge/Security-Data%20Hub-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

## ✨ Features

### 🎯 **Centralized Security Dashboard**
- **Multi-source Integration**: CrowdStrike Falcon, Secureworks, AWS Security Hub, SecurityScorecard
- **Real-time Monitoring**: Live security alerts and detection analytics
- **Risk Assessment**: Comprehensive vulnerability and compliance tracking
- **Business Intelligence**: Executive dashboards and risk reporting

### 🔐 **Enterprise Security**
- **Role-based Access Control**: Admin, Analyst, Viewer, and Business Unit Lead roles
- **Company Onboarding**: Guided setup wizard for new deployments
- **Secure Authentication**: bcrypt password hashing, JWT sessions
- **Business Unit Isolation**: Data segregation for multi-tenant environments

### 📊 **Data Sources Support**
- **CrowdStrike Falcon**: Endpoint detections and threat intelligence
- **Secureworks**: Security alerts and incident management
- **AWS Security Hub**: Cloud security findings and compliance
- **SecurityScorecard**: Third-party risk and security ratings
- **Custom Integrations**: CSV import and API endpoints

### 🚀 **Deployment Options**
- **Docker Deployment**: One-command deployment with Docker Compose
- **Development Setup**: Local development with SQLite
- **Production Setup**: PostgreSQL, Redis, Nginx with SSL
- **Cloud Ready**: AWS, GCP, Azure compatible

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │────│  Security Hub   │────│   Dashboards    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • CrowdStrike   │    │ • Data Ingestion│    │ • Executive     │
│ • Secureworks   │    │ • Normalization │    │ • Operational   │
│ • AWS Sec Hub   │    │ • Analytics     │    │ • Compliance    │
│ • ScoreCard     │    │ • Alerting      │    │ • Risk Reports  │
│ • Custom APIs   │    │ • Reporting     │    │ • Investigations│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

**Prerequisites:**
- Docker Engine 20.10+
- Docker Compose 2.0+ (optional)
- 2GB RAM, 10GB disk space

```bash
# Clone the repository
git clone https://github.com/jkrishnancp/Security_Hub_Data.git
cd Security_Hub_Data

# Simple Docker deployment (SQLite database)
docker build -t security-hub-data .
docker run -d --name security-hub -p 3000:3000 \
  -v $(pwd)/data/uploads:/app/public/uploads \
  security-hub-data

# Application available at: http://localhost:3000
# Complete the onboarding wizard to set up your company and admin account
```

### Option 2: Docker Compose Deployment

```bash
# Set up environment variables (optional - uses defaults)
cp .env.production .env

# Deploy with docker-compose
docker-compose up -d

# Application available at: http://localhost:3000
```

### Option 3: Production Deployment with PostgreSQL

```bash
# Set up environment variables for production
cp .env.production .env
# Edit .env with your production database URL and settings

# Deploy with PostgreSQL (update docker-compose.yml for PostgreSQL)
docker-compose -f docker-compose.prod.yml up -d
```

### Option 4: Local Development

**Prerequisites:**
- Node.js 18+
- npm or yarn

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.production .env.local

# Generate a secure secret for NextAuth
openssl rand -base64 32

# Edit .env.local with development values:
# - Replace NEXTAUTH_SECRET with the generated secret
# - Set NEXTAUTH_URL="http://localhost:3000"
# - Keep DATABASE_URL as "file:./prisma/dev.db" for SQLite development

# Initialize database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev

# Access at http://localhost:3000
```

## 📋 Installation Options

### 🐳 Docker Installation

| Method | Use Case | Requirements | Setup Time |
|--------|----------|--------------|------------|
| **Simple** | Development/Testing | Docker, Docker Compose | 2 minutes |
| **Production** | Production Deployment | Docker + PostgreSQL + Nginx | 5 minutes |

### 💻 Manual Installation

| Method | Use Case | Requirements | Setup Time |
|--------|----------|--------------|------------|
| **Development** | Local Development | Node.js, npm | 5 minutes |
| **Server** | Manual Server Setup | Node.js, PM2, Database | 15 minutes |

### ☁️ Cloud Deployment

| Platform | Compatibility | Documentation |
|----------|---------------|---------------|
| **AWS** | ECS, EC2, RDS | Coming Soon |
| **GCP** | Cloud Run, GKE | Coming Soon |
| **Azure** | Container Instances | Coming Soon |

## 🎯 First-Time Setup & Onboarding

### 1. Deploy the Application
Follow one of the deployment options above to get the application running.

### 2. Access the Application
1. Open your web browser
2. Navigate to `http://localhost:3000` (or your server IP)
3. You should see the Security Data Hub landing page

### 3. Complete the Onboarding Wizard

When accessing the application for the first time, clicking **"Get Started"** will automatically redirect you to the onboarding wizard:

#### Step 1: Welcome Screen 🎉
- Overview of Security Data Hub features and capabilities
- Introduction to the setup process
- Estimated completion time: 5 minutes

#### Step 2: Company Information 🏢
Configure your organization details:
```
Company Name: Your Company Name
Company Domain: company.com
```
- **Company Name**: Used throughout the application for branding
- **Company Domain**: Used for email validation and user management

#### Step 3: Administrator Account 👤
Create your first admin user:
```
Email Address: admin@company.com
Password: [Secure Password - min 8 characters]
Confirm Password: [Same as above]
```
- **Email**: Must be a valid email format
- **Password**: Minimum 8 characters, stored securely with bcrypt hashing
- This account will have full administrative privileges

#### Step 4: Profile Setup 📝
Customize your admin profile (optional but recommended):
```
First Name: John
Last Name: Doe
Display Name: John D.
Phone: +1-555-123-4567
Department: Information Security
Location: New York, NY
Avatar: [Upload profile picture]
```

#### Step 5: Setup Complete ✅
- Review your configuration
- Click **"Complete Setup"** to finalize
- Automatic redirect to login page with success message

### 4. Initial Login
1. Use the credentials created during onboarding
2. Access the main dashboard
3. Explore the navigation menu and available features

### 5. Post-Onboarding Configuration

#### User Management
- Navigate to **Admin → Users** to create additional user accounts
- Assign appropriate roles: Admin, Analyst, Viewer, or BU Lead
- Configure business unit access for data segregation

#### Data Source Configuration
1. **Go to Admin → Data Ingestion**
2. **Upload CSV files** from your security tools:
   - CrowdStrike Falcon detections
   - Secureworks alerts
   - AWS Security Hub findings
   - SecurityScorecard reports
   - Custom vulnerability reports

#### Business Unit Setup
- Configure business units in **Admin → Settings**
- Assign users to appropriate business units
- Set up data filtering and access controls

### 6. Import Historical Data
- Use **Admin → Ingest** for bulk CSV imports
- Monitor import progress and resolve any parsing errors
- Verify data appears correctly in respective dashboards

### 7. Dashboard Customization
- Explore **Dashboard**, **Detections**, **Issues**, and **Scorecard** sections
- Configure date ranges, filters, and views
- Set up regular reporting schedules

---

## 🔄 Onboarding Troubleshooting

### Common Issues During Setup

**❌ "Setup Error - Failed to set up the system"**
```bash
# Check database connectivity
docker logs [container-name]

# Ensure database has proper permissions
docker exec [container-name] ls -la /app/prisma/
```

**❌ Login redirects to onboarding instead of dashboard**
- This indicates the database doesn't have any admin users
- Complete the onboarding process to create the first admin account
- Check database connectivity if the issue persists

**❌ "Get Started" button goes to login instead of onboarding**  
- This means the system already has users configured
- Use existing credentials to login
- Reset the database if you need to restart onboarding

**❌ Database connection errors**
```bash
# Check if database file exists and has proper permissions
docker exec [container-name] ls -la /app/prisma/dev.db

# Reinitialize database schema
docker exec [container-name] npx prisma db push
```

## 🔧 Management Commands

### Docker Deployment Commands
```bash
# Build and deploy
docker build -t security-hub-data .
docker run -d --name security-hub -p 3000:3000 \
  -v $(pwd)/data/uploads:/app/public/uploads \
  security-hub-data

# Or using docker-compose
docker-compose up -d               # Deploy all services
docker-compose down               # Stop all services
docker-compose logs -f            # View logs
docker-compose ps                 # Check service status

# Container management
docker stop security-hub          # Stop the application
docker start security-hub         # Start the application
docker restart security-hub       # Restart the application
docker logs security-hub -f       # View application logs

# Database management
docker exec security-hub npx prisma db push    # Initialize/update database schema
docker exec security-hub npx prisma generate   # Generate Prisma client
docker exec security-hub npx prisma studio     # Open database browser (dev only)
```

### Development Commands
```bash
# Local development
npm install                 # Install dependencies
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run linting
npm run type-check         # TypeScript type checking

# Database commands (local development)
npx prisma db push         # Initialize database schema
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open database browser
npx prisma migrate dev     # Create and apply new migration
```

### Maintenance Commands
```bash
# Health check
curl http://localhost:3000/api/health

# View system information
docker exec security-hub node -e "console.log(process.platform, process.arch)"

# Clean up unused containers and images
docker system prune -af

# Backup data (if using volume mounts)
tar -czf backup-$(date +%Y%m%d_%H%M%S).tar.gz ./data/
```

## 📊 Data Sources Integration

### CrowdStrike Falcon
```bash
# CSV Import
1. Export detections from Falcon console
2. Navigate to Data Management → CrowdStrike
3. Upload CSV file
4. Configure field mapping
5. Start import process
```

### Secureworks
```bash
# API Integration
1. Obtain Secureworks API credentials
2. Configure in Settings → API Keys
3. Set up automated sync
4. Monitor import status
```

### AWS Security Hub
```bash
# AWS Integration
1. Configure AWS credentials
2. Set up Security Hub findings export
3. Import via CSV or API
4. Schedule regular updates
```

### SecurityScorecard
```bash
# Scorecard Integration
1. Export scorecard data
2. Import ratings and issues
3. Configure monitoring
4. Set up alerting thresholds
```

## 👥 User Management

### Roles and Permissions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Admin** | Full system access, user management | System administrators |
| **Analyst** | Data analysis, investigation tools | Security analysts |
| **Viewer** | Read-only dashboard access | Executives, stakeholders |
| **BU Lead** | Business unit data access | Department heads |

### User Operations
```bash
# Access User Management (Admin only)
1. Login as Administrator
2. Navigate to Settings → Users
3. Create, edit, or deactivate users
4. Assign roles and business units
5. Manage profile information
```

## 🔒 Security Features

### Authentication & Authorization
- **Secure Password Hashing**: bcrypt with 12 salt rounds
- **Session Management**: JWT-based secure sessions
- **Role-based Access**: 4-tier permission system
- **Business Unit Isolation**: Data segregation

### Data Protection
- **Input Validation**: Comprehensive form and API validation
- **File Security**: Type and size restrictions on uploads
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: Content Security Policy headers

### Operational Security
- **Audit Logging**: User action tracking
- **Failed Login Protection**: Rate limiting and monitoring
- **Session Timeout**: Automatic logout for inactive users
- **Secure Deployment**: Docker security best practices

## 📈 Monitoring & Maintenance

### Health Checks
```bash
# Application Health
curl http://localhost:3000/api/health

# Service Status
docker-compose ps

# View Logs
./deploy.sh logs
```

### Environment Configuration

**Key Environment Variables:**
```bash
# Required
DATABASE_URL="file:./prisma/dev.db"           # SQLite database path
NEXTAUTH_SECRET="your-secure-random-secret"   # Authentication secret
NEXTAUTH_URL="http://localhost:3000"          # Application URL

# Optional
NODE_ENV="production"                          # Environment mode
PORT=3000                                     # Application port
MAX_FILE_SIZE="50MB"                          # Upload file size limit
UPLOAD_PATH="/app/public/uploads"             # Upload directory
LOG_LEVEL="info"                              # Logging level
```

### Backup & Recovery
```bash
# Manual Backup (Docker deployment with volume mounts)
docker run --rm -v security_hub_data:/data -v $(pwd):/backup \
  alpine tar -czf /backup/backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Restore from backup
docker run --rm -v security_hub_data:/data -v $(pwd):/backup \
  alpine tar -xzf /backup/backup_file.tar.gz -C /data

# Database backup (SQLite)
docker exec security-hub cp /app/prisma/dev.db /app/public/uploads/db_backup.db
```

### Performance Tuning
- **Resource Limits**: Configure in docker-compose.yml
- **Database Optimization**: PostgreSQL tuning parameters
- **Caching**: Redis integration for improved performance
- **Log Rotation**: Automated log file management

## 🛠️ Development

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (dev), PostgreSQL (prod)
- **Authentication**: NextAuth.js
- **Deployment**: Docker, Docker Compose
- **Monitoring**: Built-in health checks and logging

### Project Structure
```
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Main dashboard pages
│   ├── detections/        # Detection management
│   ├── onboarding/        # Setup wizard
│   └── auth/              # Authentication
├── components/            # Reusable UI components
├── lib/                   # Utilities and configurations
├── prisma/               # Database schema and migrations
├── public/               # Static assets
├── types/                # TypeScript type definitions
└── deploy.sh             # Deployment automation
```

## 📚 Documentation

### Complete Guides
- [Docker Deployment Guide](./DOCKER_README.md)
- [User Manual](https://github.com/jkrishnancp/Security_Hub_Data/wiki)

## 🚨 Troubleshooting

### Common Issues

**❌ NEXTAUTH_SECRET Missing Error**
```bash
# Error: Please set NEXTAUTH_SECRET in .env file
# Solution: Generate a secure secret and add it to your .env file

# Generate a secure random string
openssl rand -base64 32

# Add to your .env or .env.local file:
NEXTAUTH_SECRET="your-generated-secret-here"
```

**❌ Port Already in Use**
```bash
# Check what's using port 3000
lsof -i :3000

# Option 1: Change port in docker run command
docker run -p 3001:3000 security-hub-data

# Option 2: Kill the process using port 3000
sudo kill $(lsof -t -i:3000)
```

**❌ Database Connection Issues**
```bash
# Check database file permissions
docker exec security-hub ls -la /app/prisma/

# Check database connectivity
docker exec security-hub npx prisma db push

# Reset database if corrupted
docker exec security-hub rm -f /app/prisma/dev.db
docker exec security-hub npx prisma db push
```

**❌ Permission Issues with File Uploads**
```bash
# Fix upload directory permissions
docker exec --user root security-hub chown -R nextjs:nodejs /app/public/uploads
docker exec security-hub chmod -R 755 /app/public/uploads

# Or on host system (if using volume mounts)
sudo chown -R $USER:$USER ./data/uploads
chmod -R 755 ./data/uploads
```

**❌ Container Won't Start**
```bash
# Check container logs for errors
docker logs security-hub

# Check if image was built correctly
docker images | grep security-hub-data

# Rebuild the image
docker build --no-cache -t security-hub-data .
```

**❌ Onboarding Flow Issues**
```bash
# If "Get Started" redirects to login instead of onboarding
# Check if database has existing users
docker exec security-hub npx prisma studio
# Look for records in the "User" table

# To reset onboarding (WARNING: Deletes all data)
docker exec security-hub rm -f /app/prisma/dev.db
docker restart security-hub
```

**❌ File Upload Errors**
```bash
# Check upload directory exists and has correct permissions
docker exec security-hub ls -la /app/public/uploads/

# Check file size limits in environment
docker exec security-hub printenv | grep MAX_FILE_SIZE

# Increase upload limits if needed (edit .env)
MAX_FILE_SIZE="100MB"
```

### Getting Help

**Enable Debug Logging:**
```bash
# Set environment variable for detailed logs
LOG_LEVEL="debug"

# View detailed logs
docker logs security-hub -f
```

**Health Check Endpoint:**
```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/jkrishnancp/Security_Hub_Data/issues)

## 🌟 Acknowledgments

Built with modern security practices and enterprise-grade reliability for security teams worldwide.

---

**🛡️ Secure by Design • 📊 Data-Driven Decisions • 🚀 Production Ready**