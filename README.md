# csv2bind - Simple bind9 CSV translator

## Install 
**csv2bind** uses **nodejs** then you can install it with **npm**.

```bash
sudo npm install -g csv2bind
```

## Run
Your CSV files must be formated as following :
* Column 1 : Hostname
* Column 2 : IP address or CNAME

The rest is ignored.

Get options and commands help:
```sh
csv2bind --help
```

Generate bind9 files:
```sh
csv2bind --help
csv2bind -domain=mydomain.com file1.csv file2.csv file3.csv
```

Generate a demonstration CSV:
```sh
csv2bind --demo
```

Process demonstration file and generate bind0 files:
```sh
csv2bind ./csv2bindDemo.csv
```

## Key features
* 2 columns CSV input format (just separate by a semicolon ';')
* Auto zone file generator
* Auto reverse IP file generator (ARPA)
* DHCP integration
* Manage nameservers zone declaration
* Compute multiple files together
* Auto zone files separation

## In-file options
* **dhcp-X** : define a DHCP pool domain generator. For example dhcp-100.domain.com will generate 100 entries such as **dhcp-1-lease.domain.com** starting at the __IP given address__. The rendering pattern is modifiable by **dhcpEJS**
* **nsX** : define an official name server for the sub domain. For example ns1.domain.com and ns2.domain.com will be registered as a nameserver for the current zone. __Where X defines the NS ID__.

## API
In the road map, the code can be ported to be used as API.

