import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './rbac/jwt-auth.guard';
import { PermissionsGuard } from './rbac/permissions.guard';
import { AuditModule } from './common/audit/audit.module';
import { CounterModule } from './common/counter/counter.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { CustomersModule } from './customers/customers.module';
import { CasesModule } from './cases/cases.module';
import { BanksModule } from './banks/banks.module';
import { DealersModule } from './dealers/dealers.module';
import { PayoutModule } from './payout/payout.module';
import { InsuranceMISModule } from './insurance-mis/insurance-mis.module';
import { InsurancePoliciesModule } from './insurance-policies/insurance-policies.module';
import { RTOTrackerModule } from './rto-tracker/rto-tracker.module';
import { ActivitiesModule } from './activities/activities.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppScheduleModule } from './schedule/schedule.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClaimsModule } from './claims/claims.module';
import { PayrollModule } from './payroll/payroll.module';
import { LeavesModule } from './leaves/leaves.module';
import { FormSchemasModule } from './form-schemas/form-schemas.module';
import { LeavePolicyModule } from './leave-policy/leave-policy.module';
import { InsuranceLeadsModule } from './insurance-leads/insurance-leads.module';
import { MailTemplatesModule } from './mail-templates/mail-templates.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    AuditModule,
    CounterModule,
    AuthModule,
    UsersModule,
    MastersModule,
    CustomersModule,
    ActivitiesModule,
    BanksModule,
    DealersModule,
    CasesModule,
    PayoutModule,
    InsuranceMISModule,
    InsurancePoliciesModule,
    RTOTrackerModule,
    NotificationsModule,
    AppScheduleModule,
    AttendanceModule,
    ClaimsModule,
    PayrollModule,
    LeavesModule,
    FormSchemasModule,
    LeavePolicyModule,
    InsuranceLeadsModule,
    MailTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
