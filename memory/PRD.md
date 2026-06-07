# Document Control Management System (QMS Foundation) - PRD

## Last Updated: 2026-06-01

## Problem Statement
Build a production-ready enterprise Document Control Management System for manufacturing, quality management, engineering, production, logistics, and compliance environments. The system provides full document lifecycle management including creation, storage, review workflows, approval workflows, revision control, obsolete document management, electronic signatures, audit trail logging, and email notifications.

## Architecture
- **Frontend**: React (JavaScript), TailwindCSS, shadcn/ui, recharts
- **Backend**: FastAPI (Python), MongoDB via Motor async driver
- **Storage**: Emergent Object Storage (for PDF, DOCX, XLSX files)
- **Email**: Resend (placeholder - user must configure)
- **Auth**: JWT with httpOnly cookies + bcrypt password hashing

## User Roles
- **admin** - Full system access, user management, settings
- **author** - Create/edit documents, submit for review
- **reviewer** - Review and approve/reject documents
- **approver** - Final approval with electronic signature
- **readonly** - View and download active documents only

## What's Been Implemented (2026-06-01)

### Backend
- JWT authentication with bcrypt, httpOnly cookies, brute force protection
- Role-based access control on all endpoints
- Document CRUD with automatic numbering (POL-001, PROC-001, etc.)
- Full document workflow: Draft → Under Review → Pending Approval → Active → Obsolete
- Electronic signatures (password re-entry for review/approval actions)
- Revision management (create new revision, auto-obsolete old)
- File upload/download via Emergent Object Storage
- Immutable audit trail logging for all actions
- Email notifications via Resend (configurable)
- Review due background checker (hourly)
- User management (CRUD for admin)
- Document types management (configurable review periods)
- Dashboard statistics by role
- Admin seeding on startup

### Frontend
- Split-screen login with professional branding
- Light/Dark theme toggle (persisted in localStorage)
- Role-based sidebar navigation
- Admin dashboard with KPI cards and bar chart
- Document list with search, status/type filters, pagination
- Document detail with tabs: Details, Workflow, History, Signatures
- Create/Edit document form with file upload
- Submit for review workflow (assign reviewers + approver)
- Electronic signature modal for review/approval actions
- Revision history table
- Audit trail with search and filtering
- User management (create/edit/deactivate)
- Settings for document types and review periods

## Default Configuration
- Doc types: Policy(POL/36mo), Procedure(PROC/12mo), Work Instruction(WI/36mo), Form(FORM/36mo), Register(REG/12mo), Manual(MAN/12mo)
- Admin: admin@doccontrol.com / Admin@12345

## P0 - Implemented
- [x] Authentication & Authorization
- [x] Document lifecycle management
- [x] Document numbering
- [x] File upload/download
- [x] Review workflow
- [x] Approval workflow with e-signatures
- [x] Revision management
- [x] Audit trail
- [x] Dashboard by role
- [x] User management
- [x] Settings

## P1 - Backlog
- [ ] Email notifications (need Resend API key from user)
- [ ] Review due email reminders (90/30/7 day schedule)
- [ ] Document search by reviewer/approver name
- [ ] Export audit trail to CSV
- [ ] Password reset workflow
- [ ] Bulk document operations

## P2 - Future
- [ ] Training Module (employees, acknowledgements, competency matrix) - DB entities reserved
- [ ] Document preview (PDF inline viewer)
- [ ] Advanced reporting and analytics
- [ ] SSO/Google Auth integration
- [ ] API rate limiting

## Database Collections
- users, documents, audit_logs, signatures, doc_types, doc_sequences, login_attempts
- Reserved for training: employees, training_assignments, training_records, document_acknowledgements, competency_matrix
