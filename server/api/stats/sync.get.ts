export default defineEventHandler(async (event) => {
  const eventStream = createEventStream(event)
  const subType = await getSubscriptionType()

  function pushProgress() {
    eventStream.push(JSON.stringify({
      subscriptionType: subType,
      status: syncProgress.status,
      total: syncProgress.total,
      processed: syncProgress.processed,
      apiStatus: apiSyncProgress.status,
      apiWindowsTotal: apiSyncProgress.windowsTotal,
      apiWindowsProcessed: apiSyncProgress.windowsProcessed,
    }))
  }

  // Phase 1: Session sync
  const syncDone = syncSessionDb()

  const interval = setInterval(pushProgress, 200)

  // Wait for session sync, then kick off API sync (skip for Max)
  await syncDone

  if (subType === 'max') {
    apiSyncProgress.status = 'skipped'
    pushProgress()
    clearInterval(interval)
    setTimeout(() => eventStream.close(), 300)
  } else {
    const apiDone = syncApiCosts()

    apiDone.then(() => {
      pushProgress()
      clearInterval(interval)
      setTimeout(() => eventStream.close(), 300)
    })
  }

  eventStream.onClosed(() => {
    clearInterval(interval)
  })

  return eventStream.send()
})
