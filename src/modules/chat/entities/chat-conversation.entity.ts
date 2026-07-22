import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ConversationType } from '../../../common/enums';
import { ChatParticipant } from './chat-participant.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_conversations')
export class ChatConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type: ConversationType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'boolean', default: false })
  is_default_group: boolean;

  @OneToMany(() => ChatParticipant, participant => participant.conversation)
  participants: ChatParticipant[];

  @OneToMany(() => ChatMessage, message => message.conversation)
  messages: ChatMessage[];

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
