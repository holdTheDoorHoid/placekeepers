import { strings } from '../../strings.ts';

export function kindLabel(kind: number): string {
  return kind === 1 ? strings.place.kindLot : kind === 2 ? strings.place.kindBuilding : strings.place.kindUnknown;
}
