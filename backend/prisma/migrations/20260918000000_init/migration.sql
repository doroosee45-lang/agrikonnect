-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY', 'BUYER', 'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR', 'LAB_PARTNER', 'API_CLIENT', 'PUBLIC_USER', 'VERIFIER', 'COUNTRY_ADMIN', 'DATA_STEWARD');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('INDIVIDUAL', 'COOPERATIVE', 'COMPANY');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('declared', 'platform_verified', 'third_party_verified', 'measured_lab', 'measured_sensor', 'estimated', 'derived', 'satellite', 'photo_interpreted');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'onRequest', 'private');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('PHONE_VERIFIED', 'PROFILE_VERIFIED', 'ORGANIZATION_VERIFIED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "PlotStatus" AS ENUM ('FALLOW', 'PLANTED', 'GROWING', 'HARVESTED', 'RESTING');

-- CreateEnum
CREATE TYPE "GeometryType" AS ENUM ('POINT', 'POLYGON');

-- CreateEnum
CREATE TYPE "CropStatus" AS ENUM ('DRAFT', 'VALIDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('PRIVATE', 'RESTRICTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CountryStatus" AS ENUM ('PLANNED', 'PILOT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('PHONE_VERIFICATION', 'LOGIN');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'COOPERATIVE_INVITATION', 'AGENT_CONSENT');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('PRODUCE', 'ANIMAL', 'PROCESSED', 'EQUIPMENT', 'INPUT', 'SERVICE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD_OUT', 'EXPIRED', 'ARCHIVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DECLARED_UNPAID', 'DECLARED_PAID');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'LOSS', 'TRANSFER', 'INVENTORY', 'RESERVATION', 'RELEASE');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('REQUESTED', 'OFFERED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('QUOTE', 'PROFORMA', 'INVOICE', 'RECEIPT', 'DELIVERY_NOTE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AiAnalysisType" AS ENUM ('CHAT', 'PLANT_PHOTO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('OPEN', 'CLOSED', 'RECALLED');

-- CreateEnum
CREATE TYPE "LotEventType" AS ENUM ('HARVEST', 'STORAGE', 'PROCESSING', 'TRANSPORT', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "PriceSourceType" AS ENUM ('AGENT', 'PARTNER', 'DECLARED_AGGREGATE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PUBLISHED', 'IN_DISCUSSION', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DataRoomRequestStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DueDiligenceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'ISSUE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FundingRequestStatus" AS ENUM ('DRAFT', 'TRANSMITTED', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GroupOfferStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_CONTROL', 'CERTIFIED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DataProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('draft', 'validated', 'retired');

-- CreateEnum
CREATE TYPE "SuitabilityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENTLY_DOCUMENTED');

-- CreateEnum
CREATE TYPE "RotationPlanStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('USSD', 'WHATSAPP');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "phone" TEXT,
    "phone_verified_at" TIMESTAMP(3),
    "first_name" TEXT,
    "last_name" TEXT,
    "whatsapp" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "country_code" CHAR(2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roles" "Role"[],
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "consent_scopes" JSONB,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currencies" TEXT[],
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "locales" TEXT[],
    "timezone" TEXT NOT NULL,
    "admin_levels" JSONB,
    "units" JSONB,
    "compliance_profile" JSONB,
    "status" "CountryStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "crops" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "cycle_days" INTEGER,
    "seasons" JSONB,
    "units" JSONB,
    "agronomy" JSONB,
    "status" "CropStatus" NOT NULL DEFAULT 'VALIDATED',
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "crops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "previous_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "province" TEXT,
    "territory" TEXT,
    "sector" TEXT,
    "village" TEXT,
    "location" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "public_latitude" DOUBLE PRECISION,
    "public_longitude" DOUBLE PRECISION,
    "public_location_precision" TEXT NOT NULL DEFAULT 'approximate',
    "total_area_ha" DOUBLE PRECISION,
    "workers" INTEGER,
    "capacity" TEXT,
    "founded_year" INTEGER,
    "visibility" JSONB NOT NULL DEFAULT '{}',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "verification_status" "VerificationLevel",
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_crops" (
    "farm_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,

    CONSTRAINT "farm_crops_pkey" PRIMARY KEY ("farm_id","crop_id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area_ha" DOUBLE PRECISION,
    "geometry_type" "GeometryType" NOT NULL DEFAULT 'POINT',
    "geometry" JSONB NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "current_crop_id" TEXT,
    "planting_date" TIMESTAMP(3),
    "status" "PlotStatus" NOT NULL DEFAULT 'FALLOW',
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_crop_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "crop_id" TEXT NOT NULL,
    "planted_at" TIMESTAMP(3),
    "harvested_at" TIMESTAMP(3),
    "declared_yield" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plot_crop_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "plot_id" TEXT,
    "crop_id" TEXT NOT NULL,
    "harvested_at" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity_kg" DOUBLE PRECISION,
    "quality" TEXT,
    "destination" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperatives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "legal_status" TEXT,
    "founded_year" INTEGER,
    "description" TEXT,
    "province" TEXT,
    "territory" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cooperatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperative_members" (
    "id" TEXT NOT NULL,
    "cooperative_id" TEXT NOT NULL,
    "member_user_id" UUID NOT NULL,
    "member_organization_id" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joined_at" TIMESTAMP(3),
    "invited_by" TEXT,
    "consent_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consent_recorded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperative_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "farm_id" TEXT,
    "plot_id" TEXT,
    "listing_id" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'PHOTO',
    "storage_key" TEXT NOT NULL,
    "url" TEXT,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "sha256" TEXT,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'PRIVATE',
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "level" "VerificationLevel" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "verification_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("verification_id","document_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "moderator_id" TEXT,
    "decision" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" UUID,
    "acting_for" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip" TEXT,
    "device" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "user_id" UUID,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'PHONE_VERIFICATION',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "user_id" UUID,
    "identifier" TEXT,
    "token_hash" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soil_assessments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "notes" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "soil_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soil_parameters" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numeric_value" DOUBLE PRECISION,
    "unit" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "method" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "measured_at" TIMESTAMP(3),
    "lab_report_id" TEXT,

    CONSTRAINT "soil_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "crop_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT,
    "indicative_price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country_code" CHAR(2) NOT NULL,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "available_from" TIMESTAMP(3),
    "available_to" TIMESTAMP(3),
    "certifications" TEXT[],
    "conditions" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "Source" NOT NULL DEFAULT 'declared',
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT,
    "budget_price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "delivery_country" CHAR(2) NOT NULL,
    "delivery_province" TEXT,
    "needed_by" TIMESTAMP(3),
    "conditions" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "listing_id" TEXT,
    "seller_org_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "conditions" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "valid_until" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "seller_org_id" TEXT NOT NULL,
    "listing_id" TEXT,
    "request_id" TEXT,
    "offer_id" TEXT,
    "snapshot" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'DECLARED_UNPAID',
    "delivery" JSONB,
    "total_amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "placed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "actor_id" TEXT,
    "actor_org_id" TEXT,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "crop_id" TEXT,
    "unit" TEXT NOT NULL,
    "low_stock_threshold" DOUBLE PRECISION,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "reason" TEXT,
    "created_by" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "requester_org_id" TEXT NOT NULL,
    "pickup" JSONB,
    "dropoff" JSONB,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "transporter_org_id" TEXT,
    "proof" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_offers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "transporter_org_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "eta_days" INTEGER,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "participant_org_ids" TEXT[],
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_org_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT[],
    "read_by" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "payload" JSONB,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "order_id" TEXT,
    "lines" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fx_rate" JSONB,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "issuer_org_id" TEXT NOT NULL,
    "recipient_org_id" TEXT,
    "pdf_key" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_org_id" TEXT NOT NULL,
    "target_org_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "response" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "opened_by_org_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "moderator_id" TEXT,
    "decision" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" TEXT NOT NULL,
    "op_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB,
    "result" TEXT NOT NULL DEFAULT 'APPLIED',
    "conflict" JSONB,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AiAnalysisType" NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "plot_id" TEXT,
    "prompt" TEXT,
    "prompt_version" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "output" JSONB,
    "confidence" "Confidence",
    "disclaimer" TEXT,
    "escalated_to" TEXT,
    "escalated_at" TIMESTAMP(3),
    "feedback" TEXT,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_data" (
    "id" TEXT NOT NULL,
    "plot_id" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "city" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "source" "PriceSourceType" NOT NULL DEFAULT 'AGENT',
    "source_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traceability_lots" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT,
    "crop_id" TEXT NOT NULL,
    "production_id" TEXT,
    "quantity_kg" DOUBLE PRECISION,
    "status" "LotStatus" NOT NULL DEFAULT 'OPEN',
    "public_fields" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traceability_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_events" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "type" "LotEventType" NOT NULL,
    "actor_id" TEXT,
    "location" JSONB,
    "details" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "reference" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "document_id" TEXT,
    "status" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT,
    "label" TEXT NOT NULL,
    "serial_number" TEXT,
    "key_hash" TEXT NOT NULL,
    "key_rotated_at" TIMESTAMP(3),
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "thresholds" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "quality" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satellite_observations" (
    "id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "index" TEXT NOT NULL DEFAULT 'NDVI',
    "value" DOUBLE PRECISION NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "cloud_cover" DOUBLE PRECISION,
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satellite_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drone_surveys" (
    "id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operator_org_id" TEXT,
    "type" TEXT NOT NULL,
    "storage_key" TEXT,
    "report_key" TEXT,
    "flown_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "lab_partner_org_id" TEXT,
    "sample_id" TEXT NOT NULL,
    "sampled_at" TIMESTAMP(3) NOT NULL,
    "parameters" JSONB NOT NULL,
    "report_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "province" TEXT,
    "description" TEXT,
    "existing_area_ha" DOUBLE PRECISION,
    "target_area_ha" DOUBLE PRECISION,
    "currentProduction" JSONB,
    "projectedProduction" JSONB,
    "fundingNeed" JSONB,
    "own_contribution" JSONB,
    "duration_months" INTEGER,
    "milestones" JSONB,
    "team" JSONB,
    "market" TEXT,
    "risks" JSONB,
    "impact" JSONB,
    "field_status" JSONB NOT NULL,
    "linked_data" JSONB NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'PRIVATE',
    "download_allowed" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_offers" (
    "id" TEXT NOT NULL,
    "cooperative_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT,
    "price_per_unit" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country_code" CHAR(2) NOT NULL,
    "status" "GroupOfferStatus" NOT NULL DEFAULT 'PROPOSED',
    "split" JSONB NOT NULL,
    "basis" JSONB NOT NULL,
    "listing_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_follows" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contact_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "requester_org_id" TEXT,
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "display_name" TEXT NOT NULL,
    "sectors" TEXT[],
    "countries" TEXT[],
    "ticket_min" DOUBLE PRECISION,
    "ticket_max" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "preferences" JSONB,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_room_access_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "grantee_user_id" TEXT NOT NULL,
    "grantee_org_id" TEXT,
    "scope" JSONB NOT NULL,
    "status" "DataRoomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "conditions" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_room_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_room_access_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_room_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_diligence_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "DueDiligenceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "evidence" TEXT[],
    "professional_name" TEXT,
    "professional_capacity" TEXT,
    "scope" TEXT,
    "comment" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_diligence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "production" JSONB,
    "progress" TEXT,
    "expenses" JSONB,
    "photos" TEXT[],
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "partner_org_id" TEXT,
    "partner_name" TEXT,
    "consent_id" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "content_snapshot" JSONB,
    "status" "FundingRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "transmitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_zones" (
    "id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "method_version" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" JSONB NOT NULL,
    "zones" JSONB NOT NULL,

    CONSTRAINT "management_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precision_reports" (
    "id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_key" TEXT,
    "rule_set_version" TEXT,
    "method_version" TEXT,
    "validated_by" TEXT,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "precision_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "buyer_org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "crop_id" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT,
    "destination_country" CHAR(2) NOT NULL,
    "certifications" TEXT[],
    "deadline" TIMESTAMP(3),
    "status" "TenderStatus" NOT NULL DEFAULT 'OPEN',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_responses" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "seller_org_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "conditions" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "seller_org_id" TEXT NOT NULL,
    "buyer_org_id" TEXT,
    "tender_id" TEXT,
    "status" "ExportOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "incoterm" TEXT,
    "destination_country" CHAR(2) NOT NULL,
    "logistics_partner_org_id" TEXT,
    "steps" JSONB,
    "total_amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fx_rate" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_documents" (
    "id" TEXT NOT NULL,
    "export_order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storage_key" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_email" TEXT,
    "scopes" TEXT[],
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "data_purpose" TEXT,
    "purpose_approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "key_id" TEXT,
    "route" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agronomic_rule_sets" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "crop_slug" TEXT,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'draft',
    "rules" JSONB NOT NULL,
    "validated_by" TEXT[],
    "validated_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agronomic_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_value" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_suitabilities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "rule_set_version" TEXT NOT NULL,
    "level" "SuitabilityLevel" NOT NULL,
    "reasons" JSONB NOT NULL,
    "used_data" JSONB NOT NULL,
    "missing_data" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "disclaimer" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_suitabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotation_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "horizon_years" INTEGER NOT NULL,
    "rule_set_version" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "alternatives" JSONB,
    "status" "RotationPlanStatus" NOT NULL DEFAULT 'PROPOSED',
    "disclaimer" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farming_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "rotation_plan_id" TEXT,
    "horizon_years" INTEGER NOT NULL,
    "calendar" JSONB NOT NULL,
    "checkpoints" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farming_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_estimates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "low_kg" DOUBLE PRECISION NOT NULL,
    "high_kg" DOUBLE PRECISION NOT NULL,
    "point_kg" DOUBLE PRECISION NOT NULL,
    "uncertainty_pct" DOUBLE PRECISION NOT NULL,
    "assumptions" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "method" TEXT NOT NULL,
    "rule_set_version" TEXT,
    "disclaimer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yield_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sessions" (
    "id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT,
    "menu" TEXT,
    "profile_id" UUID,
    "organization_id" TEXT,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_messages" (
    "id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "direction" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_secrets" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'TOTP',
    "confirmed_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "backup_codes_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "base" CHAR(3) NOT NULL,
    "quote" CHAR(3) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "source_label" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "min_group_size" INTEGER NOT NULL DEFAULT 10,
    "fields" JSONB NOT NULL,
    "status" "DataProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_contracts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "purposes" TEXT[],
    "restrictions" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "data_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregates" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "composition" JSONB NOT NULL,
    "group_count" INTEGER NOT NULL,
    "rule_version" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_phone_key" ON "profiles"("phone");

-- CreateIndex
CREATE INDEX "profiles_country_code_idx" ON "profiles"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_country_code_idx" ON "organizations"("country_code");

-- CreateIndex
CREATE INDEX "memberships_organizationId_status_idx" ON "memberships"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "crops_slug_key" ON "crops"("slug");

-- CreateIndex
CREATE INDEX "crops_category_status_idx" ON "crops"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "farms_slug_key" ON "farms"("slug");

-- CreateIndex
CREATE INDEX "farms_country_code_province_idx" ON "farms"("country_code", "province");

-- CreateIndex
CREATE INDEX "farms_latitude_longitude_idx" ON "farms"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "farms_is_public_deleted_at_idx" ON "farms"("is_public", "deleted_at");

-- CreateIndex
CREATE INDEX "farms_organization_id_idx" ON "farms"("organization_id");

-- CreateIndex
CREATE INDEX "plots_organization_id_farm_id_idx" ON "plots"("organization_id", "farm_id");

-- CreateIndex
CREATE INDEX "plots_farm_id_deleted_at_idx" ON "plots"("farm_id", "deleted_at");

-- CreateIndex
CREATE INDEX "plots_latitude_longitude_idx" ON "plots"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "plot_crop_history_plot_id_year_season_idx" ON "plot_crop_history"("plot_id", "year", "season");

-- CreateIndex
CREATE INDEX "productions_organization_id_crop_id_harvested_at_idx" ON "productions"("organization_id", "crop_id", "harvested_at");

-- CreateIndex
CREATE INDEX "productions_plot_id_harvested_at_idx" ON "productions"("plot_id", "harvested_at");

-- CreateIndex
CREATE UNIQUE INDEX "cooperatives_organization_id_key" ON "cooperatives"("organization_id");

-- CreateIndex
CREATE INDEX "cooperative_members_member_user_id_idx" ON "cooperative_members"("member_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cooperative_members_cooperative_id_member_user_id_key" ON "cooperative_members"("cooperative_id", "member_user_id");

-- CreateIndex
CREATE INDEX "media_farm_id_position_idx" ON "media"("farm_id", "position");

-- CreateIndex
CREATE INDEX "media_plot_id_position_idx" ON "media"("plot_id", "position");

-- CreateIndex
CREATE INDEX "media_listing_id_position_idx" ON "media"("listing_id", "position");

-- CreateIndex
CREATE INDEX "documents_organization_id_category_idx" ON "documents"("organization_id", "category");

-- CreateIndex
CREATE INDEX "verifications_status_created_at_idx" ON "verifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "verifications_subject_type_subject_id_idx" ON "verifications"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_created_at_idx" ON "audit_logs"("resource", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "otp_codes_identifier_purpose_created_at_idx" ON "otp_codes"("identifier", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "tokens_token_hash_idx" ON "tokens"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_identifier_purpose_idx" ON "tokens"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "soil_assessments_plot_id_assessed_at_idx" ON "soil_assessments"("plot_id", "assessed_at");

-- CreateIndex
CREATE INDEX "soil_parameters_assessment_id_idx" ON "soil_parameters"("assessment_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_scope_key" ON "idempotency_keys"("key", "scope");

-- CreateIndex
CREATE INDEX "listings_status_crop_id_country_code_idx" ON "listings"("status", "crop_id", "country_code");

-- CreateIndex
CREATE INDEX "listings_organization_id_status_idx" ON "listings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "listings_latitude_longitude_idx" ON "listings"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "purchase_requests_status_crop_id_needed_by_idx" ON "purchase_requests"("status", "crop_id", "needed_by");

-- CreateIndex
CREATE INDEX "purchase_requests_buyer_org_id_status_idx" ON "purchase_requests"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "offers_request_id_status_idx" ON "offers"("request_id", "status");

-- CreateIndex
CREATE INDEX "offers_listing_id_status_idx" ON "offers"("listing_id", "status");

-- CreateIndex
CREATE INDEX "offers_seller_org_id_idx" ON "offers"("seller_org_id");

-- CreateIndex
CREATE INDEX "orders_buyer_org_id_status_idx" ON "orders"("buyer_org_id", "status");

-- CreateIndex
CREATE INDEX "orders_seller_org_id_status_idx" ON "orders"("seller_org_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "order_events_order_id_at_idx" ON "order_events"("order_id", "at");

-- CreateIndex
CREATE INDEX "inventory_items_organization_id_label_idx" ON "inventory_items"("organization_id", "label");

-- CreateIndex
CREATE INDEX "inventory_movements_organization_id_item_id_at_idx" ON "inventory_movements"("organization_id", "item_id", "at");

-- CreateIndex
CREATE INDEX "inventory_movements_ref_type_ref_id_idx" ON "inventory_movements"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "transport_requests_order_id_status_idx" ON "transport_requests"("order_id", "status");

-- CreateIndex
CREATE INDEX "transport_requests_transporter_org_id_status_idx" ON "transport_requests"("transporter_org_id", "status");

-- CreateIndex
CREATE INDEX "transport_offers_request_id_status_idx" ON "transport_offers"("request_id", "status");

-- CreateIndex
CREATE INDEX "conversations_status_updated_at_idx" ON "conversations"("status", "updated_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_channel_key" ON "notification_preferences"("user_id", "type", "channel");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_number_key" ON "invoices"("organization_id", "number");

-- CreateIndex
CREATE INDEX "reviews_target_org_id_status_idx" ON "reviews"("target_org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_author_org_id_key" ON "reviews"("order_id", "author_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- CreateIndex
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_op_id_key" ON "sync_operations"("op_id");

-- CreateIndex
CREATE INDEX "sync_operations_organization_id_applied_at_idx" ON "sync_operations"("organization_id", "applied_at");

-- CreateIndex
CREATE INDEX "sync_operations_collection_applied_at_idx" ON "sync_operations"("collection", "applied_at");

-- CreateIndex
CREATE INDEX "ai_analyses_organization_id_created_at_idx" ON "ai_analyses"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_analyses_status_created_at_idx" ON "ai_analyses"("status", "created_at");

-- CreateIndex
CREATE INDEX "weather_data_plot_id_observed_at_idx" ON "weather_data"("plot_id", "observed_at");

-- CreateIndex
CREATE INDEX "market_prices_crop_id_market_observed_at_idx" ON "market_prices"("crop_id", "market", "observed_at");

-- CreateIndex
CREATE INDEX "market_prices_country_code_observed_at_idx" ON "market_prices"("country_code", "observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "traceability_lots_code_key" ON "traceability_lots"("code");

-- CreateIndex
CREATE INDEX "traceability_lots_organization_id_created_at_idx" ON "traceability_lots"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "lot_events_lot_id_at_idx" ON "lot_events"("lot_id", "at");

-- CreateIndex
CREATE INDEX "certifications_organization_id_status_idx" ON "certifications"("organization_id", "status");

-- CreateIndex
CREATE INDEX "certifications_expires_at_idx" ON "certifications"("expires_at");

-- CreateIndex
CREATE INDEX "iot_devices_organization_id_status_idx" ON "iot_devices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "sensor_readings_device_id_at_idx" ON "sensor_readings"("device_id", "at");

-- CreateIndex
CREATE INDEX "sensor_readings_metric_at_idx" ON "sensor_readings"("metric", "at");

-- CreateIndex
CREATE INDEX "satellite_observations_plot_id_observed_at_idx" ON "satellite_observations"("plot_id", "observed_at");

-- CreateIndex
CREATE INDEX "drone_surveys_plot_id_flown_at_idx" ON "drone_surveys"("plot_id", "flown_at");

-- CreateIndex
CREATE INDEX "lab_results_plot_id_sampled_at_idx" ON "lab_results"("plot_id", "sampled_at");

-- CreateIndex
CREATE INDEX "lab_results_sample_id_idx" ON "lab_results"("sample_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_sector_country_code_idx" ON "projects"("status", "sector", "country_code");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "project_documents_project_id_category_idx" ON "project_documents"("project_id", "category");

-- CreateIndex
CREATE INDEX "group_offers_cooperative_id_status_idx" ON "group_offers"("cooperative_id", "status");

-- CreateIndex
CREATE INDEX "project_follows_user_id_idx" ON "project_follows"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_follows_project_id_user_id_key" ON "project_follows"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_contact_requests_status_expires_at_idx" ON "project_contact_requests"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_contact_requests_project_id_requester_user_id_key" ON "project_contact_requests"("project_id", "requester_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_user_id_key" ON "investor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "investor_profiles_verified_at_idx" ON "investor_profiles"("verified_at");

-- CreateIndex
CREATE INDEX "data_room_access_requests_project_id_status_idx" ON "data_room_access_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "data_room_access_requests_grantee_user_id_status_idx" ON "data_room_access_requests"("grantee_user_id", "status");

-- CreateIndex
CREATE INDEX "data_room_access_logs_project_id_at_idx" ON "data_room_access_logs"("project_id", "at");

-- CreateIndex
CREATE INDEX "data_room_access_logs_user_id_at_idx" ON "data_room_access_logs"("user_id", "at");

-- CreateIndex
CREATE INDEX "due_diligence_items_project_id_category_idx" ON "due_diligence_items"("project_id", "category");

-- CreateIndex
CREATE INDEX "progress_reports_project_id_published_at_idx" ON "progress_reports"("project_id", "published_at");

-- CreateIndex
CREATE INDEX "impact_reports_project_id_published_at_idx" ON "impact_reports"("project_id", "published_at");

-- CreateIndex
CREATE INDEX "funding_requests_project_id_status_idx" ON "funding_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "management_zones_plot_id_computed_at_idx" ON "management_zones"("plot_id", "computed_at");

-- CreateIndex
CREATE INDEX "precision_reports_plot_id_generated_at_idx" ON "precision_reports"("plot_id", "generated_at");

-- CreateIndex
CREATE INDEX "tenders_status_crop_id_deadline_idx" ON "tenders"("status", "crop_id", "deadline");

-- CreateIndex
CREATE INDEX "tender_responses_tender_id_status_idx" ON "tender_responses"("tender_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "export_orders_reference_key" ON "export_orders"("reference");

-- CreateIndex
CREATE INDEX "export_orders_seller_org_id_status_idx" ON "export_orders"("seller_org_id", "status");

-- CreateIndex
CREATE INDEX "export_orders_destination_country_status_idx" ON "export_orders"("destination_country", "status");

-- CreateIndex
CREATE INDEX "export_documents_export_order_id_type_idx" ON "export_documents"("export_order_id", "type");

-- CreateIndex
CREATE INDEX "api_clients_status_idx" ON "api_clients"("status");

-- CreateIndex
CREATE INDEX "api_keys_client_id_status_idx" ON "api_keys"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_usage_client_id_at_idx" ON "api_usage"("client_id", "at");

-- CreateIndex
CREATE INDEX "agronomic_rule_sets_status_country_code_zone_idx" ON "agronomic_rule_sets"("status", "country_code", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "agronomic_rule_sets_version_zone_crop_slug_key" ON "agronomic_rule_sets"("version", "zone", "crop_slug");

-- CreateIndex
CREATE INDEX "zone_feature_flags_key_enabled_idx" ON "zone_feature_flags"("key", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "zone_feature_flags_key_scope_scope_value_key" ON "zone_feature_flags"("key", "scope", "scope_value");

-- CreateIndex
CREATE INDEX "crop_suitabilities_plot_id_crop_id_generated_at_idx" ON "crop_suitabilities"("plot_id", "crop_id", "generated_at");

-- CreateIndex
CREATE INDEX "crop_suitabilities_organization_id_generated_at_idx" ON "crop_suitabilities"("organization_id", "generated_at");

-- CreateIndex
CREATE INDEX "rotation_plans_plot_id_created_at_idx" ON "rotation_plans"("plot_id", "created_at");

-- CreateIndex
CREATE INDEX "farming_plans_plot_id_created_at_idx" ON "farming_plans"("plot_id", "created_at");

-- CreateIndex
CREATE INDEX "yield_estimates_plot_id_created_at_idx" ON "yield_estimates"("plot_id", "created_at");

-- CreateIndex
CREATE INDEX "channel_sessions_channel_phone_idx" ON "channel_sessions"("channel", "phone");

-- CreateIndex
CREATE INDEX "channel_messages_channel_phone_created_at_idx" ON "channel_messages"("channel", "phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_secrets_user_id_key" ON "mfa_secrets"("user_id");

-- CreateIndex
CREATE INDEX "fx_rates_base_quote_as_of_idx" ON "fx_rates"("base", "quote", "as_of");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_base_quote_as_of_key" ON "fx_rates"("base", "quote", "as_of");

-- CreateIndex
CREATE UNIQUE INDEX "data_products_slug_key" ON "data_products"("slug");

-- CreateIndex
CREATE INDEX "data_products_status_idx" ON "data_products"("status");

-- CreateIndex
CREATE INDEX "data_contracts_client_id_product_id_idx" ON "data_contracts"("client_id", "product_id");

-- CreateIndex
CREATE INDEX "aggregates_product_id_period_idx" ON "aggregates"("product_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "aggregates_product_id_key_period_rule_version_key" ON "aggregates"("product_id", "key", "period", "rule_version");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_crops" ADD CONSTRAINT "farm_crops_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_current_crop_id_fkey" FOREIGN KEY ("current_crop_id") REFERENCES "crops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_crop_history" ADD CONSTRAINT "plot_crop_history_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_crop_history" ADD CONSTRAINT "plot_crop_history_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperatives" ADD CONSTRAINT "cooperatives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperative_members" ADD CONSTRAINT "cooperative_members_cooperative_id_fkey" FOREIGN KEY ("cooperative_id") REFERENCES "cooperatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_assessments" ADD CONSTRAINT "soil_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_assessments" ADD CONSTRAINT "soil_assessments_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_parameters" ADD CONSTRAINT "soil_parameters_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "soil_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_offers" ADD CONSTRAINT "transport_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "transport_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_events" ADD CONSTRAINT "lot_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "traceability_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_room_access_requests" ADD CONSTRAINT "data_room_access_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_items" ADD CONSTRAINT "due_diligence_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_reports" ADD CONSTRAINT "impact_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_responses" ADD CONSTRAINT "tender_responses_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_documents" ADD CONSTRAINT "export_documents_export_order_id_fkey" FOREIGN KEY ("export_order_id") REFERENCES "export_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregates" ADD CONSTRAINT "aggregates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "data_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;







