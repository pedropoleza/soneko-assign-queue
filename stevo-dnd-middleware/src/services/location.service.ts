import { locations, LocationConfig, StevoInstance } from '../config/locations';
import { NoActiveInstanceError, UnknownLocationError } from '../utils/errors';

/**
 * Resolve a configuração de uma location do GHL e as instâncias Stevo
 * que devem ser processadas.
 */
export const locationService = {
  getLocation(locationId: string): LocationConfig {
    const config = locations[locationId];
    if (!config) {
      throw new UnknownLocationError(locationId);
    }
    return config;
  },

  /**
   * Instâncias ativas a processar para uma location.
   * - blockOnAllInstances = true  -> todas as instâncias ativas
   * - blockOnAllInstances = false -> apenas a primeira instância ativa
   */
  getTargetInstances(locationId: string): { config: LocationConfig; instances: StevoInstance[] } {
    const config = this.getLocation(locationId);
    const active = config.stevoInstances.filter((i) => i.active);

    if (active.length === 0) {
      throw new NoActiveInstanceError(locationId);
    }

    const instances = config.blockOnAllInstances ? active : [active[0] as StevoInstance];
    return { config, instances };
  },
};
