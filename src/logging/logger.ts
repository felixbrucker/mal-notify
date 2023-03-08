import {Logger, ISettingsParam} from 'tslog'

export function makeLogger<LogObj>(options: ISettingsParam<LogObj> = {}): Logger<LogObj> {
  return new Logger({
    ...options,
    prettyLogTemplate: '{{dateIsoStr}} {{logLevelName}}\t[{{name}}] ',
  })
}

export const defaultLogger = makeLogger({ name: 'Main' })
