import {AnimeListItem, MalApi} from './mal-api.js'
import {MalUser, MalUserModel} from '../database/model/mal-user.js'
import {HydratedDocument, Types} from 'mongoose'
import {Anime, AnimeFields, AnimeModel, AnimeStatus} from '../database/model/anime.js'
import dayjs from 'dayjs'
import {makeLogger} from '../logging/logger.js'
import {CleanupService} from '../database/cleanup-service.js'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

interface AnimeSyncResult {
  entity: HydratedDocument<Anime>
  statusChanged: boolean
  endDateChanged: boolean
}

interface MalUserSyncResult {
  animeSyncResults: AnimeSyncResult[]
  removedAnimeIds: Types.ObjectId[]
}

export interface AnimeNotifier {
  animeStatusChanged(anime: HydratedDocument<Anime>): Promise<void>
}

export class ChangeDetection {
  private intervalTimer?: ReturnType<typeof setInterval>
  private readonly cleanupService: CleanupService = new CleanupService()
  private readonly logger = makeLogger({ name: 'Change-Detection' })

  constructor(
    private readonly malApi: MalApi,
    private readonly notifier: AnimeNotifier,
  ) {}

  public async init() {
    await this.detectChanges()
    this.intervalTimer = setInterval(this.detectChanges.bind(this), 60 * 60 * 1000)
    this.logger.info('Initialized')
  }

  public shutdown() {
    if (this.intervalTimer !== undefined) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = undefined
    }
  }

  public async detectChanges() {
    const syncResults = await this.sync()
    const animesWithStatusChanges = syncResults
      .filter(syncResult => syncResult.statusChanged || syncResult.endDateChanged)
      .map(change => change.entity)
    if (animesWithStatusChanges.length === 0) {
      return
    }
    await Promise.all(animesWithStatusChanges.map(this.notifier.animeStatusChanged.bind(this.notifier)))
  }

  private async sync(): Promise<AnimeSyncResult[]> {
    const malUsers = await MalUserModel.find()
    const malUserSyncResults: MalUserSyncResult[] = []
    for (const malUser of malUsers) {
      malUserSyncResults.push(await this.syncMalUser(malUser))
    }
    await MalUserModel.bulkSave(malUsers)
    const removedAnimeIds = malUserSyncResults.flatMap(malUserSyncResult => malUserSyncResult.removedAnimeIds)
    await Promise.all(removedAnimeIds.map(this.cleanupService.cleanupAnimeIfUnused.bind(this.cleanupService)))

    return malUserSyncResults.flatMap(malUserSyncResult => malUserSyncResult.animeSyncResults)
  }

  private async syncMalUser(malUser: HydratedDocument<MalUser>): Promise<MalUserSyncResult> {
    const ptwAnimeList = await this.malApi.getPlanToWatchAnimeList(malUser.username)
    const animeSyncResults: AnimeSyncResult[] = await Promise.all(ptwAnimeList.map(this.syncAnime.bind(this)))
    const removedAnimeIds = malUser.planToWatchAnimes.filter(animeId => animeSyncResults.every(result => result.entity.id.toString() !== animeId.toString()))
    malUser.planToWatchAnimes = animeSyncResults.map(syncResult => syncResult.entity.id)
    await AnimeModel.bulkSave(animeSyncResults.map(syncResult => syncResult.entity))

    return {
      animeSyncResults,
      removedAnimeIds,
    }
  }

  private async syncAnime(animeListItem: AnimeListItem): Promise<AnimeSyncResult> {
    const animeFields: AnimeFields = {
      malId: animeListItem.id,
      title: animeListItem.title,
      titleEn: animeListItem.alternative_titles?.en ?? undefined,
      imageUrl: animeListItem.main_picture?.large ?? animeListItem.main_picture?.medium ?? undefined,
      startDate: animeListItem.start_date ? dayjs.tz(animeListItem.start_date, 'JST').toDate() : undefined,
      endDate: animeListItem.end_date ? dayjs.tz(animeListItem.end_date, 'JST').toDate() : undefined,
      status: animeListItem.status as AnimeStatus,
      numberOfEpisodes: animeListItem.num_episodes,
    }
    const existingAnime: HydratedDocument<Anime>|null = await AnimeModel.findOne({ malId: animeListItem.id })
    if (existingAnime === null) {
      return {
        entity: new AnimeModel(animeFields),
        statusChanged: false,
        endDateChanged: false,
      }
    }
    const previousStatus = existingAnime.status
    const previousEndDate = existingAnime.endDate?.getTime()
    existingAnime.update(animeFields)

    return {
      entity: existingAnime,
      statusChanged: existingAnime.status !== previousStatus,
      endDateChanged: existingAnime.endDate?.getTime() !== previousEndDate,
    }
  }
}
