import {HydratedDocument, model, Model, Schema, SchemaDefinition, SchemaDefinitionType, Types} from 'mongoose'
import {Snowflake} from 'discord.js'
import {MalUser} from './mal-user.js'

export interface DiscordUser {
  discordId: Snowflake
  subscribedToUsers: Types.ObjectId[]

  subscribeTo(malUser: HydratedDocument<MalUser>)
  unsubscribeFrom(malUser: HydratedDocument<MalUser>)
}

const schemaDefinition: SchemaDefinition<SchemaDefinitionType<DiscordUser>> = {
  discordId: {
    type: String,
    required: true,
    unique: true,
  },
  subscribedToUsers: [{
    type: Types.ObjectId,
    ref: 'MalUser',
    default: [],
  }],
}

interface DiscordUserModel extends Model<DiscordUser> {}

function addInstanceMethods(schema: Schema<DiscordUser, DiscordUserModel>) {
  schema.method('subscribeTo', function (malUser: HydratedDocument<MalUser>) {
    if (this.subscribedToUsers.every(userId => userId.toString() !== malUser.id.toString())) {
      this.subscribedToUsers.push(malUser.id)
    }
  })

  schema.method('unsubscribeFrom', function (malUser: HydratedDocument<MalUser>) {
    this.subscribedToUsers = this.subscribedToUsers.filter(userId => userId.toString() !== malUser.id.toString())
  })
}

function makeDiscordUserModel(): DiscordUserModel {
  const schema = new Schema<DiscordUser, DiscordUserModel>(schemaDefinition, {
    autoIndex: true,
  })

  addInstanceMethods(schema)

  return model<DiscordUser, DiscordUserModel>('DiscordUser', schema)
}

export const DiscordUserModel = makeDiscordUserModel()
