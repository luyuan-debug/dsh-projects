/** connection.fetch already authenticates the owner and validates browser authority.
 * Its Fetch Request uses http://dsh.internal, while Host/Origin preserve the real listener.
 */
export function validateProjectRequest(request,contentType='application/json'){
  const origin=request.headers.get('origin'),host=request.headers.get('host'),target=new URL(request.url);
  const native=target.protocol==='dsh-app:'&&target.host==='app'&&!target.username&&!target.password;
  if(origin&&!(native&&origin==='null')){let url;try{url=new URL(origin)}catch{throw new Error('ORIGIN_REJECTED')}
    if(native ? url.protocol!=='dsh-app:'||url.host!=='app' : !['http:','https:'].includes(url.protocol)||url.host!==host)throw new Error('ORIGIN_REJECTED');
  }
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new Error('ORIGIN_REJECTED');
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!==contentType)throw new Error('JSON_CONTENT_TYPE_REQUIRED');
}
