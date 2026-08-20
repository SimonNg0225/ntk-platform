import { createCollection, type Entity } from '../../../../lib/store'

export interface ExerciseFavorite extends Entity {
  exerciseId: string
}

export const exerciseFavoritesCol = createCollection<ExerciseFavorite>(
  'fitness_library_favs_v1',
)
