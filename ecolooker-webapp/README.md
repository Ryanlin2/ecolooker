# ecolooker-webapp

Contains a single app: [`ecolooker/`](ecolooker), the Next.js frontend that
renders the CFPB and BEA dashboards. The extra nesting level (`ecolooker-webapp/ecolooker/`
rather than the app living at this directory directly) is a leftover of how
the app was originally scaffolded (`create-next-app` run inside this folder)
— there's nothing else planned to live alongside it at this level.

See [`ecolooker/README.md`](ecolooker/README.md) for how to run it, how the
dashboards fetch and render data, and the component catalog.
