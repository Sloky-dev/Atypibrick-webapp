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
export type LegoSetPage = { items: LegoSet[]; hasMore: boolean; nextCursor: string | null }
export type CollectionFilters = { theme: string; condition: string; gift: '' | 'true' | 'false'; purchaseDateFrom: string; purchaseDateTo: string; priceMin: string; priceMax: string; partsMin: string; partsMax: string; sort: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'parts_asc' | 'parts_desc' | 'purchase_date_asc' | 'purchase_date_desc' }
export type CollectionBreakdownItem = { label: string; count: number }
export type CollectionSummary = { setCount: number; itemCount: number; totalInvested: string; totalParts: number; themes: CollectionBreakdownItem[]; conditions: CollectionBreakdownItem[]; purchaseYears: CollectionBreakdownItem[] }
export type LegoSetNameLookup = { setNumber: string; name: string; theme: string | null; numParts: number | null; imageUrl: string | null }
export type User = { email: string }
export type TokenPair = { accessToken: string; tokenType: string }
export type LoginResponse = TokenPair & { user: User }
export type InventoryItem = { id: string; legoSetId: string | null; setNumber: string; name: string; theme: string | null; condition: string; purchasePrice: string; imageUrl: string | null; status: 'pending' | 'present' | 'absent'; verifiedAt: string | null; deletedFromCollection: boolean; deletedAt: string | null }
export type InventorySession = { id: string; status: 'active' | 'completed'; createdAt: string; completedAt: string | null; totalCount: number; verifiedCount: number; presentCount: number; absentCount: number; deletedCount: number; items: InventoryItem[] }
export type InventoryOverview = { active: InventorySession | null; history: InventorySession[] }
export type TrashItem = LegoSet & { deletedAt: string; expiresAt: string }
