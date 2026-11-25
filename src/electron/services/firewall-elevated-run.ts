import { allowThroughFirewallIfStartedForIt } from './firewall'

// Imported first by main.ts, for its effect: a run started only to change the firewall rules ends here, before any
// other service is loaded. Some of them act as soon as they are, and such a run is elevated, where mapped drives do
// not exist and the folders on them look gone.
allowThroughFirewallIfStartedForIt()
