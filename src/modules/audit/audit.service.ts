import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async createLog(data: {
    user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    old_data?: Record<string, any> | null;
    new_data?: Record<string, any> | null;
    ip_address?: string | null;
  }): Promise<AuditLog> {
    const log = this.auditRepository.create({
      user_id: data.user_id ?? null,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id ?? null,
      old_data: data.old_data ?? null,
      new_data: data.new_data ?? null,
      ip_address: data.ip_address ?? null,
    });
    return this.auditRepository.save(log);
  }
}
