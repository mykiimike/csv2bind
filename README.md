dhcp-X : define a DHCP pool domain generator. For example dhcp-100.domain.com will generate 100 entries such as **dhcp-1-lease.domain.com** starting at the __IP given address__. The rendering pattern is modifiable by **dhcpEJS**
nsX : define an official name server for the sub domain. For example ns1.domain.com and ns2.domain.com will be registered as a nameserver for the current zone. Where X defines the NS ID.