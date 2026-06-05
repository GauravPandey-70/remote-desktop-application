import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const url = process.env.DATABASE_URL ?? 'postgresql://desklink:desklink_dev@localhost:5432/desklink';
        return {
          type: 'postgres',
          url,
          entities: Object.values(entities),
          synchronize: process.env.NODE_ENV !== 'production', // Only sync in development, use migrations for production
          logging: process.env.LOG_LEVEL === 'debug',
          poolSize: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
        };
      },
    }),
    TypeOrmModule.forFeature(Object.values(entities)),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
