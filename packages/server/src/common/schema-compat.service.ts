import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

type ColumnSpec = {
  table: string;
  column: string;
  definition: string;
};

const MYSQL_COMPAT_COLUMNS: ColumnSpec[] = [
  // property
  { table: 'property', column: 'cover_image', definition: '`cover_image` varchar(512) NULL' },
  { table: 'property', column: 'note', definition: '`note` text NULL' },

  // room
  { table: 'room', column: 'available_date', definition: '`available_date` date NULL' },
  { table: 'room', column: 'deposit', definition: '`deposit` decimal(10,2) NULL' },
  { table: 'room', column: 'area', definition: '`area` varchar(32) NULL' },
  { table: 'room', column: 'floor', definition: '`floor` varchar(32) NULL' },
  { table: 'room', column: 'orientation', definition: '`orientation` varchar(16) NULL' },
  { table: 'room', column: 'facilities', definition: '`facilities` json NULL' },
  { table: 'room', column: 'images', definition: '`images` json NULL' },
  { table: 'room', column: 'note', definition: '`note` text NULL' },

  // tenant
  { table: 'tenant', column: 'pay_months', definition: '`pay_months` tinyint unsigned NOT NULL DEFAULT 1' },
  { table: 'tenant', column: 'deposit', definition: '`deposit` decimal(10,2) NULL' },
  { table: 'tenant', column: 'note', definition: '`note` text NULL' },
  { table: 'tenant', column: 'move_out_date', definition: '`move_out_date` date NULL' },
  { table: 'tenant', column: 'deposit_status', definition: '`deposit_status` tinyint unsigned NOT NULL DEFAULT 0' },
  { table: 'tenant', column: 'deposit_refund_amount', definition: '`deposit_refund_amount` decimal(10,2) NULL' },
  { table: 'tenant', column: 'deposit_deduct_reason', definition: '`deposit_deduct_reason` varchar(256) NULL' },
  { table: 'tenant', column: 'initial_payment_method', definition: '`initial_payment_method` varchar(20) NULL' },
  { table: 'tenant', column: 'initial_payment_date', definition: '`initial_payment_date` varchar(10) NULL' },
  { table: 'tenant', column: 'initial_payment_amount', definition: '`initial_payment_amount` decimal(10,2) NULL' },
  { table: 'tenant', column: 'move_in_reading', definition: '`move_in_reading` varchar(256) NULL' },
  { table: 'tenant', column: 'move_out_reading', definition: '`move_out_reading` varchar(256) NULL' },
  { table: 'tenant', column: 'prepaid_refund_amount', definition: '`prepaid_refund_amount` decimal(10,2) NULL' },

  // fee_item
  { table: 'fee_item', column: 'enabled', definition: '`enabled` tinyint unsigned NOT NULL DEFAULT 1' },
  { table: 'fee_item', column: 'is_rent', definition: '`is_rent` tinyint unsigned NOT NULL DEFAULT 0' },
  { table: 'fee_item', column: 'cycle_mode', definition: "`cycle_mode` varchar(16) NOT NULL DEFAULT 'rent'" },
  { table: 'fee_item', column: 'sort_order', definition: '`sort_order` int NOT NULL DEFAULT 0' },

  // bill
  { table: 'bill', column: 'period_end', definition: '`period_end` varchar(7) NULL' },
  { table: 'bill', column: 'paid_amount', definition: '`paid_amount` decimal(10,2) NOT NULL DEFAULT 0' },
  { table: 'bill', column: 'photos', definition: '`photos` json NULL' },
  { table: 'bill', column: 'sent_at', definition: '`sent_at` datetime NULL' },
  { table: 'bill', column: 'paid_at', definition: '`paid_at` datetime NULL' },

  // payment_qr
  { table: 'payment_qr', column: 'is_default', definition: '`is_default` tinyint unsigned NOT NULL DEFAULT 0' },
  { table: 'payment_qr', column: 'payee_name', definition: '`payee_name` varchar(32) NOT NULL DEFAULT \'\'' },
  { table: 'payment_qr', column: 'note', definition: '`note` varchar(256) NULL' },

  // single_charge
  { table: 'single_charge', column: 'paid_at', definition: '`paid_at` datetime NULL' },
];

@Injectable()
export class SchemaCompatService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaCompatService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (this.dataSource.options.type !== 'mysql') return;
    await this.ensureMysqlColumns();
  }

  private async ensureMysqlColumns() {
    const database = this.dataSource.options.database;
    if (!database || typeof database !== 'string') return;

    const pending: ColumnSpec[] = [];
    for (const spec of MYSQL_COMPAT_COLUMNS) {
      const rows = await this.dataSource.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [database, spec.table, spec.column],
      );
      if (!rows.length) pending.push(spec);
    }

    if (!pending.length) {
      this.logger.log('MySQL schema compatibility check passed');
      return;
    }

    this.logger.warn(`Adding ${pending.length} missing MySQL compatibility columns`);
    for (const spec of pending) {
      this.logger.warn(`ALTER TABLE ${spec.table} ADD COLUMN ${spec.column}`);
      await this.dataSource.query(`ALTER TABLE \`${spec.table}\` ADD COLUMN ${spec.definition}`);
    }
  }
}
