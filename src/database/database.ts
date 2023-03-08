import mongoose from 'mongoose'
import {Logger} from 'tslog'
import { makeLogger } from '../logging/logger.js'

// Exclude properties not defined in the schema from queries
mongoose.set('strictQuery', true)

export type DatabaseOptions = {
  databaseUrl: string
}

export class Database {
  public static make(options: DatabaseOptions): Database {
    return new Database(options.databaseUrl)
  }

  private readonly logger: Logger<unknown> = makeLogger({ name: 'Database' })

  private constructor(private readonly url: string) {}

  public async startup(): Promise<void> {
    await mongoose.connect(this.url, {
      autoIndex: true,
      readPreference: 'nearest',
    })
    mongoose.connection.on('error', (err: Error) => this.logger.error(err))
    this.logger.info('Initialized')
  }

  public async shutdown(): Promise<void> {
    await mongoose.disconnect()
  }
}
