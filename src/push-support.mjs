export function pushSupport({ios=false,standalone=false,secure=false,notification=false,push=false}={}){return !secure?'https':ios&&!standalone?'install':!notification||!push?'unsupported':'ready';}
