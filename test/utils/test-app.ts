import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import type { App } from 'supertest/types';
import { configureApp } from '../../src/app.setup';

/** Boots the real AppModule against an in-memory MongoDB. */
export class TestApp {
  app: INestApplication;
  private mongod: MongoMemoryServer;

  static async create(): Promise<TestApp> {
    const instance = new TestApp();
    instance.mongod = await MongoMemoryServer.create();

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = instance.mongod.getUri('nest-task-api-e2e');
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-0000';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret-00';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';
    process.env.THROTTLE_LIMIT = '1000';

    // imported after the env is set: ConfigModule validates process.env at import time
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    instance.app = moduleRef.createNestApplication({ logger: false });
    configureApp(instance.app);
    await instance.app.init();

    // wait for index builds so unique-constraint tests cannot race them
    const connection = instance.app.get<Connection>(getConnectionToken());
    await Promise.all(Object.values(connection.models).map((m) => m.init()));
    return instance;
  }

  get server(): App {
    return this.app.getHttpServer() as App;
  }

  async reset(): Promise<void> {
    const connection = this.app.get<Connection>(getConnectionToken());
    await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})));
  }

  async close(): Promise<void> {
    await this.app.close();
    await this.mongod.stop();
  }
}
