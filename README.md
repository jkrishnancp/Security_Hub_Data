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
- Docker Compose 2.0+
- 2GB RAM, 10GB disk space

```bash
# Clone the repository
git clone https://github.com/jkrishnancp/Security_Hub_Data.git
cd Security_Hub_Data

# Deploy with one command
./deploy.sh deploy

# Application available at: http://localhost:3000
# Complete the onboarding wizard to set up your company and admin account
```

### Option 2: Production Deployment

```bash
# Set up environment variables
cp .env.production .env
# Edit .env with your production values

# Deploy with PostgreSQL, Redis, and Nginx
./deploy.sh deploy-prod
```

### Option 3: Local Development

**Prerequisites:**
- Node.js 18+
- npm or yarn

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.production .env.local
# Edit .env.local with development values

# Initialize database
npx prisma db push

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

## 🎯 First-Time Setup

### 1. Deploy the Application
```bash
./deploy.sh deploy
```

### 2. Complete Onboarding Wizard
1. **Welcome**: Overview of features and capabilities
2. **Company Setup**: Configure company name and domain
3. **Admin Account**: Create your administrator credentials
4. **Profile Setup**: Customize your profile with avatar and details
5. **Complete**: Finalize setup and access dashboard

### 3. Configure Data Sources
- Navigate to **Settings → Data Sources**
- Add your security tool integrations
- Configure API credentials and endpoints
- Set up data import schedules

### 4. Import Historical Data
- Use **Data Management → Import** for CSV files
- Configure automated data ingestion
- Set up real-time API integrations

## 🔧 Management Commands

```bash
# Deployment
./deploy.sh deploy          # Deploy with SQLite
./deploy.sh deploy-prod     # Deploy with PostgreSQL
./deploy.sh stop            # Stop all services
./deploy.sh logs            # View logs
./deploy.sh status          # Check service status
./deploy.sh backup          # Manual backup

# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run linting
npm run test               # Run tests
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

### Backup & Recovery
```bash
# Automatic Backups
- Created before each deployment
- Stored in ./backups/
- Includes database and uploaded files

# Manual Backup
./deploy.sh backup

# Restore Example
tar -xzf ./backups/backup_20240101_120000.tar.gz -C ./data/
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

**Port Already in Use**
```bash
# Check what's using port 3000
lsof -i :3000

# Change port in docker-compose.yml
ports:
  - "3001:3000"
```

**Database Connection Issues**
```bash
# Check database health
docker-compose exec postgres pg_isready -U security_user

# View database logs
docker-compose logs postgres
```

**Permission Issues**
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data
chmod -R 755 ./data
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/jkrishnancp/Security_Hub_Data/issues)

## 🌟 Acknowledgments

Built with modern security practices and enterprise-grade reliability for security teams worldwide.

---

**🛡️ Secure by Design • 📊 Data-Driven Decisions • 🚀 Production Ready**