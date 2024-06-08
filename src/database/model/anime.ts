import {model, Model, Schema, SchemaDefinition, SchemaDefinitionType} from 'mongoose'
import {Snowflake} from 'discord.js'

export enum AnimeStatus {
  notYetAired = 'not_yet_aired',
  currentlyAiring = 'currently_airing',
  finishedAiring = 'finished_airing',
}

export interface AnimeFields {
  malId: number
  title: string
  titleEn?: string
  imageUrl?: string
  startDate?: Date
  endDate?: Date
  status: AnimeStatus
  numberOfEpisodes: number
}

export interface Anime extends AnimeFields {
  update(anime: AnimeFields): void
  getSubscribedDiscordUserIds(): Promise<Snowflake[]>
}

const schemaDefinition: SchemaDefinition<SchemaDefinitionType<Anime>> = {
  malId: {
    type: Number,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  titleEn: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
  },
  numberOfEpisodes: {
    type: Number,
    required: true,
  },
}

interface AnimeModel extends Model<Anime> {}

function addInstanceMethods(schema: Schema<Anime, AnimeModel>) {
  schema.method('update', function (anime: AnimeFields) {
    if (this.title !== anime.title) {
      this.title = anime.title
    }
    if (this.titleEn !== anime.titleEn) {
      this.titleEn = anime.titleEn
    }
    if (this.imageUrl !== anime.imageUrl) {
      this.imageUrl = anime.imageUrl
    }
    if (this.startDate !== anime.startDate) {
      this.startDate = anime.startDate
    }
    if (this.endDate !== anime.endDate) {
      this.endDate = anime.endDate
    }
    if (this.status !== anime.status) {
      this.status = anime.status
    }
    if (this.numberOfEpisodes !== anime.numberOfEpisodes) {
      this.numberOfEpisodes = anime.numberOfEpisodes
    }
  })

  schema.method('getSubscribedDiscordUserIds', async function (): Promise<Snowflake[]> {
    const result = await model<unknown>('DiscordUser').aggregate([
      {
        $lookup: {
          from: 'malusers',
          localField: 'subscribedToUsers',
          foreignField: '_id',
          as: 'subscribedToUsers',
          pipeline: [{
            $match: { planToWatchAnimes: this._id },
          }],
        },
      },
      {
        $match: { subscribedToUsers: { $ne: [] } },
      },
      {
        $group: {
          _id: null,
          discordIds: { $addToSet: '$discordId' },
        },
      },
    ])
    if (result.length !== 1) {
      return []
    }

    return result[0].discordIds
  })
}

function makeAnimeModel(): AnimeModel {
  const schema = new Schema<Anime, AnimeModel>(schemaDefinition, {
    autoIndex: true,
  })

  addInstanceMethods(schema)

  return model<Anime, AnimeModel>('Anime', schema)
}

export const AnimeModel = makeAnimeModel()
