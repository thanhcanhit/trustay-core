# Tenant-Landlord Interaction Flow

## Complete Flow with Automatic Contract Generation

```mermaid
flowchart TD
    A[Tenant] --> B[Browse Rooms/Posts]
    B --> C{Room Available?}
    
    C -->|Yes| D[Send Booking Request]
    C -->|No| E[Create Room Seeking Post]
    
    D --> F[Landlord Reviews Request]
    F --> G{Approve Request?}
    
    G -->|Yes| H[Auto-Create Rental]
    G -->|No| I[Reject Request]
    
    H --> J[Auto-Generate Contract]
    J --> K[Send Notifications]
    K --> L[Active Rental with Contract]
    
    I --> M[Notify Tenant]
    
    E --> N[Landlord Sees Post]
    N --> O[Send Room Invitation]
    O --> P[Tenant Reviews Invitation]
    P --> Q{Accept Invitation?}
    
    Q -->|Yes| R[Auto-Create Rental]
    Q -->|No| S[Decline Invitation]
    
    R --> T[Auto-Generate Contract]
    T --> U[Send Notifications]
    U --> L
    
    S --> V[Notify Landlord]
    
    L --> W[Contract Management]
    W --> X[View/Update/Amend Contract]
    X --> Y[Download Contract PDF]
    
    L --> Z[Rental Lifecycle]
    Z --> AA[Terminate/Renew Contract]
    
    style H fill:#90EE90
    style J fill:#FFD700
    style R fill:#90EE90
    style T fill:#FFD700
    style L fill:#87CEEB
```

## Key Features
- **Auto-Creation**: Rental and Contract are created automatically when booking is approved or invitation is accepted
- **Notification System**: All parties are notified at each step
- **Contract Management**: Full contract lifecycle with PDF generation
- **Error Handling**: Graceful fallback if auto-generation fails