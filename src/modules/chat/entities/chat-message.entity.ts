import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MessageType } from '../../../common/enums';
import { ChatConversation } from './chat-conversation.entity';
import { User } from '../../users/entities/user.entity';
import { MediaFile } from '../../media/entities/media-file.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => ChatConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ChatConversation;

  @Column({ type: 'uuid' })
  sender_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({
    type: 'enum',
    enum: MessageType,
  })
  message_type: MessageType;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'uuid', nullable: true })
  media_file_id: string | null;

  @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'media_file_id' })
  media_file: MediaFile | null;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_edited: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  edited_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
