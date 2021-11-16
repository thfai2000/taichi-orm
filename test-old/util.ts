import {omit} from 'lodash'
import { Model } from '../dist';
type SimpleObject = {
  [key: string]: any
}

var objectConstructor = ({}).constructor;

export const clearSysFields = (o: any): any => {
  if(o === null){
    return o
  } else if( Array.isArray(o)) {
    return o.map( i => clearSysFields(i))
  } else if (
      (o instanceof Object && o.constructor === objectConstructor) ||
      o instanceof Model
    ){
    
      let item: SimpleObject = omit(o, ['uuid'])
      return Object.keys(item).reduce( (acc, key) => {
        acc[key] = clearSysFields( item[key] )
        return acc
      }, {} as SimpleObject)
  }
  return o
}