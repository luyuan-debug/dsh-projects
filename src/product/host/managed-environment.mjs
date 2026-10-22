import {join} from 'node:path';
import {homedir} from 'node:os';
import {profileDomainName} from './environment.mjs';
/** Derive only plugin-owned paths from the actual public Host identity. */
export function pluginEnvironment(config,{profile,dshHome,execPath=process.execPath,dataHome=process.env.XDG_DATA_HOME??join(homedir(),'.local','share')}){
 const automatic=!config.allowedRoot;
 const allowedRoot=config.allowedRoot??join(dataHome,'dsh-project-threads',profileDomainName(dshHome+'@'+profile));
 return {...config,profile:config.profile??profile,dshHome:config.dshHome??dshHome,allowedRoot,fixturesRoot:config.fixturesRoot??join(allowedRoot,'projects'),evidenceRoot:config.evidenceRoot??join(allowedRoot,'logs'),launchCwd:config.launchCwd??join(allowedRoot,'launch'),dshBin:config.dshBin??execPath,approvedExternalDshHome:config.approvedExternalDshHome??(automatic?dshHome:undefined)};
}
