import {model, Model, Schema, SchemaDefinition, SchemaDefinitionType, Types} from 'mongoose'
import {Anime} from './anime.js'

export interface MalUser {
  username: string
  planToWatchAnimes: Types.ObjectId[]
}

const schemaDefinition: SchemaDefinition<SchemaDefinitionType<MalUser>> = {
  username: {
    type: String,
    required: true,
    unique: true,
  },
  planToWatchAnimes: [{
    type: Types.ObjectId,
    ref: 'Anime',
    default: [],
  }],
}

interface MalUserModel extends Model<MalUser> {}

function makeMalUserModel(): MalUserModel {
  const schema = new Schema<MalUser, MalUserModel>(schemaDefinition, {
    autoIndex: true,
  })

  return model<MalUser, MalUserModel>('MalUser', schema)
}

export const MalUserModel = makeMalUserModel()
