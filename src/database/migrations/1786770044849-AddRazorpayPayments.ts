import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRazorpayPayments1786770044849 implements MigrationInterface {
    name = 'AddRazorpayPayments1786770044849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payment_transactions_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_transactions_purpose_enum" AS ENUM('REGISTRATION_FEE', 'WALLET_TOPUP')`);
        await queryRunner.query(`CREATE TABLE "payment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "razorpay_order_id" character varying(100) NOT NULL, "razorpay_payment_id" character varying(100), "razorpay_signature" character varying(255), "amount" numeric(12,2) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'INR', "status" "public"."payment_transactions_status_enum" NOT NULL DEFAULT 'PENDING', "purpose" "public"."payment_transactions_purpose_enum" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."media_files_purpose_enum" RENAME TO "media_files_purpose_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."media_files_purpose_enum" AS ENUM('PROFILE_PIC', 'BUSINESS_LOGO', 'OFFER_IMAGE', 'GENERAL')`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" TYPE "public"."media_files_purpose_enum" USING "purpose"::"text"::"public"."media_files_purpose_enum"`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" SET DEFAULT 'GENERAL'`);
        await queryRunner.query(`DROP TYPE "public"."media_files_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "bizz_coin_value" SET DEFAULT '1'`);
        await queryRunner.query(`ALTER TYPE "public"."vouchers_status_enum" RENAME TO "vouchers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."vouchers_status_enum" AS ENUM('ISSUED', 'REDEEMED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" TYPE "public"."vouchers_status_enum" USING "status"::"text"::"public"."vouchers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'ISSUED'`);
        await queryRunner.query(`DROP TYPE "public"."vouchers_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_transactions_reference_type_enum" ADD VALUE 'PAYMENT_GATEWAY'`);
        await queryRunner.query(`ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_77fab0556decc83a81a5bf8c25d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_77fab0556decc83a81a5bf8c25d"`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_transactions_reference_type_enum_old" AS ENUM('VOUCHER', 'REFERRAL', 'MANUAL')`);
        await queryRunner.query(`ALTER TABLE "wallet_transactions" ALTER COLUMN "reference_type" TYPE "public"."wallet_transactions_reference_type_enum_old" USING "reference_type"::"text"::"public"."wallet_transactions_reference_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_transactions_reference_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."wallet_transactions_reference_type_enum_old" RENAME TO "wallet_transactions_reference_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."vouchers_status_enum_old" AS ENUM('ISSUED', 'REDEEMED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" TYPE "public"."vouchers_status_enum_old" USING "status"::"text"::"public"."vouchers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'ISSUED'`);
        await queryRunner.query(`DROP TYPE "public"."vouchers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."vouchers_status_enum_old" RENAME TO "vouchers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "bizz_coin_value" SET DEFAULT 1.00`);
        await queryRunner.query(`CREATE TYPE "public"."media_files_purpose_enum_old" AS ENUM('PROFILE_PIC', 'PAYMENT_RECEIPT', 'BUSINESS_LOGO', 'OFFER_IMAGE', 'GENERAL')`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" TYPE "public"."media_files_purpose_enum_old" USING "purpose"::"text"::"public"."media_files_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "media_files" ALTER COLUMN "purpose" SET DEFAULT 'GENERAL'`);
        await queryRunner.query(`DROP TYPE "public"."media_files_purpose_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."media_files_purpose_enum_old" RENAME TO "media_files_purpose_enum"`);
        await queryRunner.query(`DROP TABLE "payment_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."payment_transactions_purpose_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_transactions_status_enum"`);
    }

}
