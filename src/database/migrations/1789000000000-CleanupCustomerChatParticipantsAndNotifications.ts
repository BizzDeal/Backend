import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupCustomerChatParticipantsAndNotifications1789000000000
  implements MigrationInterface
{
  name = 'CleanupCustomerChatParticipantsAndNotifications1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove all CUSTOMER users from the default community group participants
    await queryRunner.query(`
      DELETE FROM "chat_participants"
      WHERE "conversation_id" IN (
        SELECT "id" FROM "chat_conversations" WHERE "is_default_group" = true
      )
      AND "user_id" IN (
        SELECT "id" FROM "users" WHERE "role" = 'CUSTOMER'
      )
    `);

    // 2. Remove orphaned member-only notifications delivered to CUSTOMER users
    await queryRunner.query(`
      DELETE FROM "notifications"
      WHERE "user_id" IN (
        SELECT "id" FROM "users" WHERE "role" = 'CUSTOMER'
      )
      AND (
        "type" IN ('CHAT', 'MEETING', 'FEATURED_REQUEST')
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
