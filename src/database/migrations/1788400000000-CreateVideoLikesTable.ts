import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideoLikesTable1788400000000 implements MigrationInterface {
  name = 'CreateVideoLikesTable1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "video_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_likes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_video_likes_user_video" UNIQUE ("user_id", "video_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_video_likes_user_id" ON "video_likes" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_video_likes_video_id" ON "video_likes" ("video_id")`);

    await queryRunner.query(`
      ALTER TABLE "video_likes"
      ADD CONSTRAINT "FK_video_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "video_likes"
      ADD CONSTRAINT "FK_video_likes_video_id" FOREIGN KEY ("video_id") REFERENCES "member_videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "video_likes" DROP CONSTRAINT IF EXISTS "FK_video_likes_video_id"`);
    await queryRunner.query(`ALTER TABLE "video_likes" DROP CONSTRAINT IF EXISTS "FK_video_likes_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_video_likes_video_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_video_likes_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "video_likes"`);
  }
}
