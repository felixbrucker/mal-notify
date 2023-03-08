import { Mal } from 'node-myanimelist'
import {MalAcount} from 'node-myanimelist/typings/methods/malApi/index.js'
import {WorkBase, WorkForList} from 'node-myanimelist/typings/methods/malApi/common/index.js'
import {AnimeForList} from 'node-myanimelist/typings/methods/malApi/anime/types.js'

export interface AnimeListItem extends WorkBase, WorkForList.AlternativeTitles, WorkForList.StartDate, WorkForList.EndDate, AnimeForList.Status, AnimeForList.NumEpisodes {}

export class MalApi {
  private account: MalAcount

  public async init() {
    this.account = await Mal.auth().guestLogin()
  }

  public async getPlanToWatchAnimeList(username: string): Promise<AnimeListItem[]> {
    const limit = 100
    let animeList: AnimeListItem[] = []
    let hasNextPage = false
    let offset = 0
    do {
      const list = await this.account.user
        .animelist(
          username,
          Mal.Anime.fields().alternativeTitles().startDate().endDate().status().numEpisodes(),
          null,
          {
            status: 'plan_to_watch',
            includeNsfw: true,
            limit,
            offset,
          },
        )
        .call()
      animeList = animeList.concat(list.data.map(item => item.node))
      hasNextPage = !!list.paging.next
      offset += limit
    } while(hasNextPage)

    return animeList
  }

  public async exists(username: string): Promise<boolean> {
    try {
      await this.account.user.animelist(username).call()

      return true
    } catch (err) {
      return false
    }
  }
}
