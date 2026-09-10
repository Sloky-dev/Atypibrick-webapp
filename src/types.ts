export type LegoSet = {
  id: string
  setNumber: string
  name: string
  theme: string | null
  purchaseDate: string | null
  purchasePrice: string
  quantity: number
  condition: string
  imageUrl: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type LegoSetPayload = Omit<LegoSet, 'id' | 'createdAt' | 'updatedAt'>
export type CollectionSummary = { setCount: number; itemCount: number; totalInvested: string; averagePrice: string }
export type User = { email: string }
export type LoginResponse = { accessToken: string; tokenType: string; user: User }
