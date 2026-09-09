import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupCustomerChatParticipantsAndNotifications1789000000000
  implements MigrationInterface
{
  name = 'CleanupCustomerChatParticipantsAndNotifications1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure FEATURED_REQUEST is added to the notifications_type_enum in Postgres
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'FEATURED_REQUEST'
    `);

    // 2. Remove all CUSTOMER users from the default community group participants
    await queryRunner.query(`
      DELETE FROM "chat_participants"
      WHERE "conversation_id" IN (
        SELECT "id" FROM "chat_conversations" WHERE "is_default_group" = true
      )
      AND "user_id" IN (
        SELECT "id" FROM "users" WHERE "role" = 'CUSTOMER'
      )
    `);

    // 3. Remove orphaned member-only notifications delivered to CUSTOMER users
    await queryRunner.query(`
      DELETE FROM "notifications"
      WHERE "user_id" IN (
        SELECT "id" FROM "users" WHERE "role" = 'CUSTOMER'
      )
      AND (
        "type"::text IN ('CHAT', 'MEETING', 'FEATURED_REQUEST')
        OR "data"->>'audience' = 'ALL_MEMBERS'
        OR "data"->>'screen' = 'referrals'
        OR "data"->>'type' IN ('REFERRAL', 'REFERRAL_APPRECIATION')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op for cleanup deletion
  }
}
