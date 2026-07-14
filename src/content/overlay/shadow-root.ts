export const createShadowPortal = (id: string) => {
  const host = document.createElement('div')
  host.id = id
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  return { host, shadow }
}
