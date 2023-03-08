import {HydratedDocument, Types} from 'mongoose'
import {MalUser, MalUserModel} from './model/mal-user.js'
import {DiscordUserModel} from './model/discord-user.js'
import {AnimeModel} from './model/anime.js'

export class CleanupService {
  public async cleanupMalUserIfUnused(malUser: HydratedDocument<MalUser>) {
    const malUserHasOtherDiscordUsers = await DiscordUserModel.exists({ subscribedToUsers: malUser._id })
    if (malUserHasOtherDiscordUsers) {
      return
    }
    await MalUserModel.deleteOne({ _id: malUser._id })
    await Promise.all(malUser.planToWatchAnimes.map(this.cleanupAnimeIfUnused.bind(this)))
  }

  public async cleanupAnimeIfUnused(animeId: Types.ObjectId) {
    const animeHasOtherMalUsers = await MalUserModel.exists({ planToWatchAnimes: animeId })
    if (animeHasOtherMalUsers) {
      return
    }
    await AnimeModel.deleteOne({ _id: animeId })
  }
}
