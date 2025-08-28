import {HydratedDocument} from 'mongoose'
import {Anime, AnimeStatus} from '../../database/model/anime.js'
import {APIEmbed, BaseMessageOptions, ColorResolvable, Colors, EmbedBuilder} from 'discord.js'
import dayjs from 'dayjs'

export function makeAnimesMessageOptions(animes: HydratedDocument<Anime>[]): BaseMessageOptions[] {
  return animes.chunk(10).map(chunk => ({
    embeds: chunk.map(makeAnimeMessageEmbed),
  }))
}

export function makeAnimeMessageOptions(anime: HydratedDocument<Anime>): BaseMessageOptions {
  return {
    embeds: [makeAnimeMessageEmbed(anime)],
  }
}

export function makeAnimeMessageEmbed(anime: HydratedDocument<Anime>): APIEmbed {
  const numberOfEpisodes = anime.numberOfEpisodes || 12
  const startDate = anime.startDate ? dayjs(anime.startDate) : undefined
  let endDate = anime.endDate ? dayjs(anime.endDate) : undefined
  if (endDate === undefined) {
    if (startDate !== undefined) {
      endDate = startDate.add(numberOfEpisodes, 'weeks')
    }
  }
  let relativeStartDate: string|undefined
  let relativeEndDate: string|undefined
  if (startDate === undefined) {
    relativeStartDate = undefined
  } else if (startDate.isToday()) {
    relativeStartDate = 'today'
  } else {
    relativeStartDate = startDate.fromNow()
  }
  if (endDate === undefined) {
    relativeEndDate = undefined
  } else if (endDate.isToday()) {
    relativeEndDate = 'today'
  } else {
    relativeEndDate = endDate.fromNow()
  }
  let formattedState: string
  let color: ColorResolvable
  switch (anime.status) {
    case AnimeStatus.currentlyAiring:
      if (startDate === undefined) {
        formattedState = 'started airing'
      } else if (startDate.isToday()) {
        formattedState = 'started airing today'
      } else if (startDate.isBefore(dayjs().tz('JST').startOf('day'))) {
        formattedState = `started airing ${startDate.fromNow()}`
      } else {
        formattedState = `will start airing ${startDate.fromNow()}`
      }
      color = Colors.Aqua
      break
    case AnimeStatus.finishedAiring:
      if (endDate === undefined) {
        formattedState = 'finished airing'
      } else if (endDate.isToday()) {
        formattedState = 'finished airing today'
      } else if (endDate.isBefore(dayjs().tz('JST').startOf('day'))) {
        formattedState = `finished airing ${endDate.fromNow()}`
      } else {
        formattedState = `will finish airing ${endDate.fromNow()}`
      }
      color = Colors.Green
      break
    case AnimeStatus.notYetAired:
      formattedState = 'did not air yet'
      color = Colors.Grey
      break
  }
  let title = anime.title
  if (anime.titleEn !== undefined && anime.title !== anime.titleEn) {
    title += `\n${anime.titleEn}`
  }

  return new EmbedBuilder()
      .setTitle(`Anime ${formattedState}`)
      .setColor(color)
      .addFields([{
        name: 'Title',
        value: title,
      }, {
        name: 'Start date',
        value: startDate ? `${startDate.format('YYYY-MM-DD')} (${relativeStartDate})` : 'N/A',
        inline: true,
      }, {
        name: `End date${anime.endDate === undefined ? ' (estimated)' : ''}`,
        value: endDate ? `${endDate.format('YYYY-MM-DD')} (${relativeEndDate})` : 'N/A',
        inline: true,
      }, {
        name: 'Episodes',
        value: `${anime.numberOfEpisodes === 0 ? `${numberOfEpisodes} (guessed)` : anime.numberOfEpisodes}`,
        inline: true,
      }])
      .setURL(`https://myanimelist.net/anime/${anime.malId}`)
      .setThumbnail(anime.imageUrl ?? null)
      .toJSON()
}
