export type LegoSet = {
  id: string
  setNumber: string
  name: string
  theme: string | null
  numParts: number | null
  purchaseDate: string | null
  purchasePrice: string
  isGift: boolean
  condition: string
  imageUrl: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type LegoSetPayload = Omit<LegoSet, 'id' | 'name' | 'theme' | 'numParts' | 'imageUrl' | 'createdAt' | 'updatedAt'>
export type CollectionSummary = { setCount: number; itemCount: number; totalInvested: string; averagePrice: string }
export type LegoSetNameLookup = { setNumber: string; name: string; theme: string | null; numParts: number | null; imageUrl: string | null }
export type User = { email: string }
export type LoginResponse = { accessToken: string; tokenType: string; user: User }
